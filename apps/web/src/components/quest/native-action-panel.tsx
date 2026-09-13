"use client"

import { useCallback, useMemo, useState } from "react"
import { useAccount, useReadContract, useSwitchChain, useWriteContract } from "wagmi"
import { formatUnits, parseUnits } from "viem"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CREDITCOIN_CHAIN_ID } from "@/lib/chains"
import { ActionType, VerificationRule } from "@/lib/attestcoin/types"
import { erc20Abi, nativePortalAbi, uniswapV3PoolAbi } from "@/lib/attestcoin/abi"
import { CONTRACT_ADDRESSES, PENGUINSWAP } from "@/lib/contracts"

interface NativeActionPanelProps {
  questId: bigint
  rule: VerificationRule
  onCompleted?: (creditcoinTxHash: string) => void
}

const SLIPPAGE_CHOICES = [
  { label: "0.5%", bps: 50 },
  { label: "1%", bps: 100 },
  { label: "5%", bps: 500 },
]

/**
 * Price one token in the other from the pool's own `slot0`.
 *
 * `sqrtPriceX96` is sqrt(token1/token0) in Q64.96, so the price of token0 in token1 is
 * `(sqrtPriceX96 / 2^96)^2`. Kept in bigint throughout: the numbers here are 18 decimals and a
 * float would lose the low end of them silently.
 *
 * This is the spot price and ignores the price impact of the trade itself. Against a pool holding
 * about 1.2 million WCTC the impact of a quest-sized swap is far inside the slippage floor the
 * player picks, and if it ever is not the swap reverts rather than filling badly.
 */
function quoteOut(sqrtPriceX96: bigint, amountIn: bigint, sellingToken0: boolean): bigint {
  const Q96 = 1n << 96n
  if (sellingToken0) {
    // amountIn * price, with the squaring done before the division so nothing rounds to zero.
    return (amountIn * sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96)
  }
  return (amountIn * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96)
}

/**
 * The completion panel for a quest whose action happens on Creditcoin.
 *
 * There is no proof step here and no transaction hash to paste, because the action and the
 * completion are the same transaction: NativePortal pulls the player's tokens, performs the swap
 * with the player as the recipient, and records the completion, or the whole thing reverts.
 */
export function NativeActionPanel({ questId, rule, onCompleted }: NativeActionPanelProps) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const isWrap = rule.actionType === ActionType.WrapNative
  const tokenIn = (rule.token && rule.token !== "0x0000000000000000000000000000000000000000"
    ? rule.token
    : PENGUINSWAP.WCTC) as `0x${string}`
  const tokenOut = tokenIn.toLowerCase() === PENGUINSWAP.USD1.toLowerCase()
    ? PENGUINSWAP.WCTC
    : PENGUINSWAP.USD1

  // Both sides of the only liquid pair are 18 decimals, checked on chain and recorded in
  // docs/ADDRESSES.md.
  const decimals = 18
  const minimum = rule.minAmount
  const [amount, setAmount] = useState(() => formatUnits(minimum > 0n ? minimum : parseUnits("1", decimals), decimals))
  const [slippageBps, setSlippageBps] = useState(SLIPPAGE_CHOICES[1]!.bps)
  const [busy, setBusy] = useState<"approve" | "send" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  const amountIn = useMemo(() => {
    try {
      return parseUnits(amount || "0", decimals)
    } catch {
      return 0n
    }
  }, [amount])

  const { data: slot0 } = useReadContract({
    abi: uniswapV3PoolAbi,
    address: PENGUINSWAP.POOL_WCTC_USD1,
    functionName: "slot0",
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: !isWrap && !!PENGUINSWAP.POOL_WCTC_USD1, refetchInterval: 20_000 },
  })
  const { data: poolToken0 } = useReadContract({
    abi: uniswapV3PoolAbi,
    address: PENGUINSWAP.POOL_WCTC_USD1,
    functionName: "token0",
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: !isWrap && !!PENGUINSWAP.POOL_WCTC_USD1 },
  })
  const { data: balance } = useReadContract({
    abi: erc20Abi,
    address: tokenIn,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: !isWrap && !!address },
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: erc20Abi,
    address: tokenIn,
    functionName: "allowance",
    args: address ? [address, CONTRACT_ADDRESSES.NATIVE_PORTAL] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: !isWrap && !!address },
  })

  const expectedOut = useMemo(() => {
    if (isWrap || !slot0 || !poolToken0 || amountIn === 0n) return null
    const sellingToken0 = tokenIn.toLowerCase() === (poolToken0 as string).toLowerCase()
    return quoteOut(slot0[0] as bigint, amountIn, sellingToken0)
  }, [amountIn, isWrap, poolToken0, slot0, tokenIn])

  const minOut = expectedOut === null ? 0n : (expectedOut * BigInt(10_000 - slippageBps)) / 10_000n
  const needsApproval = !isWrap && amountIn > 0n && (allowance ?? 0n) < amountIn
  const belowMinimum = amountIn < minimum
  const shortOfBalance = !isWrap && balance !== undefined && amountIn > (balance as bigint)

  const ensureNetwork = useCallback(async () => {
    if (!isConnected) throw new Error("Connect your wallet first.")
    if (chainId !== CREDITCOIN_CHAIN_ID) await switchChain?.({ chainId: CREDITCOIN_CHAIN_ID })
  }, [chainId, isConnected, switchChain])

  const approve = useCallback(async () => {
    setError(null)
    setBusy("approve")
    try {
      await ensureNetwork()
      await writeContractAsync({
        abi: erc20Abi,
        address: tokenIn,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.NATIVE_PORTAL, amountIn],
        chainId: CREDITCOIN_CHAIN_ID,
      })
      await refetchAllowance()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(null)
    }
  }, [amountIn, ensureNetwork, refetchAllowance, tokenIn, writeContractAsync])

  const send = useCallback(async () => {
    setError(null)
    setBusy("send")
    try {
      await ensureNetwork()
      const hash = isWrap
        ? await writeContractAsync({
            abi: nativePortalAbi,
            address: CONTRACT_ADDRESSES.NATIVE_PORTAL,
            functionName: "wrapNative",
            args: [questId],
            value: amountIn,
            chainId: CREDITCOIN_CHAIN_ID,
          })
        : await writeContractAsync({
            abi: nativePortalAbi,
            address: CONTRACT_ADDRESSES.NATIVE_PORTAL,
            functionName: "swapViaPenguinSwap",
            args: [questId, tokenIn, tokenOut, PENGUINSWAP.FEE, amountIn, minOut],
            chainId: CREDITCOIN_CHAIN_ID,
          })
      setSent(hash)
      onCompleted?.(hash)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(null)
    }
  }, [amountIn, ensureNetwork, isWrap, minOut, onCompleted, questId, tokenIn, tokenOut, writeContractAsync])

  return (
    <div className="space-y-4">
      <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <h3 className="text-sm font-semibold text-emerald-300">This one happens on Creditcoin</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          There is no proof to build and nothing to wait for. NativePortal performs the action with
          your own tokens and records the completion in the same transaction, so it either all
          happens or none of it does.
        </p>
      </div>

      <div className="rounded border border-[#1A1A1A] bg-black">
        <div className="border-b border-[#1A1A1A] px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            {isWrap ? "Wrap CTC into WCTC" : "Swap on PenguinSwap"}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {isWrap
              ? "The amount you send is the amount you get back as WCTC, paid straight to you."
              : "The router pays the proceeds to your address. Vael never holds them."}
          </p>
        </div>

        <div className="space-y-3 px-4 py-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">
              {isWrap ? "CTC to wrap" : "Amount to sell"}
            </span>
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value.trim())}
              inputMode="decimal"
              spellCheck={false}
              className="mt-1 rounded border-zinc-800 bg-black font-mono text-xs text-white"
            />
          </label>

          <p className="text-[11px] text-zinc-600">
            The quest minimum is {formatUnits(minimum, decimals)}
            {isWrap ? " CTC" : ""}.
            {!isWrap && balance !== undefined && (
              <> You hold {formatUnits(balance as bigint, decimals)}.</>
            )}
          </p>

          {!isWrap && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">Slippage</span>
              {SLIPPAGE_CHOICES.map((choice) => (
                <button
                  key={choice.bps}
                  type="button"
                  onClick={() => setSlippageBps(choice.bps)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                    slippageBps === choice.bps
                      ? "border-white bg-white text-black"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          )}

          {!isWrap && (
            <p className="text-[11px] leading-relaxed text-zinc-600">
              {expectedOut === null
                ? "Reading the pool price…"
                : `About ${Number(formatUnits(expectedOut, decimals)).toFixed(4)} out at the current pool price, and the transaction reverts below ${Number(formatUnits(minOut, decimals)).toFixed(4)}.`}
            </p>
          )}

          {belowMinimum && (
            <p className="text-[11px] text-amber-400">
              Below the quest minimum. The contract would refuse this before moving a token.
            </p>
          )}
          {shortOfBalance && (
            <p className="text-[11px] text-amber-400">More than you hold.</p>
          )}

          {needsApproval ? (
            <Button
              type="button"
              onClick={approve}
              disabled={busy !== null || amountIn === 0n}
              className="w-full rounded bg-white text-black hover:bg-white/90"
            >
              {busy === "approve" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving…
                </>
              ) : (
                "Approve NativePortal"
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={send}
              disabled={busy !== null || amountIn === 0n || belowMinimum || shortOfBalance}
              className="w-full rounded bg-white text-black hover:bg-white/90"
            >
              {busy === "send" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirm on Creditcoin…
                </>
              ) : isWrap ? (
                "Wrap and complete"
              ) : (
                "Swap and complete"
              )}
            </Button>
          )}

          {error && <p className="text-xs leading-relaxed text-red-400">{error}</p>}
          {sent && (
            <p className="break-all text-[11px] text-emerald-400">
              Done in one transaction: <span className="font-mono">{sent}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

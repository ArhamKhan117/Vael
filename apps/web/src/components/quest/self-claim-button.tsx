"use client"

import { useCallback, useState } from "react"
import { useAccount, useSwitchChain, useWriteContract } from "wagmi"
import { BaseError, ContractFunctionRevertedError } from "viem"
import { Loader2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CREDITCOIN_CHAIN_ID } from "@/lib/chains"
import { questAscAbi } from "@/lib/attestcoin/abi"
import { ProofNotReadyError, fetchProof, toSubmitArgs } from "@/lib/attestcoin/proofBuilder"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"

interface SelfClaimButtonProps {
  questId: bigint
  /** The Sepolia transaction that satisfies the quest. */
  sourceTxHash: string
  sourceChainKey?: number
  onClaimed?: (creditcoinTxHash: string) => void
}

type Phase = "idle" | "fetching" | "signing" | "done"

/**
 * Claim a quest from the player's own wallet, with no Vael server involved.
 *
 * This is the path that makes the platform's central claim true: the proof is fetched straight
 * from the Attestcoin Proof Builder in the browser and submitted to QuestASC by the player, so a
 * quest can be completed while our API is offline. The worker is a convenience, not a dependency.
 *
 * The proof is fetched at the moment of claiming, never earlier and never cached, because proof
 * material perishes as attestations advance.
 */
export function SelfClaimButton({
  questId,
  sourceTxHash,
  sourceChainKey = 1,
  onClaimed,
}: SelfClaimButtonProps) {
  const { isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const claim = useCallback(async () => {
    setError(null)
    try {
      if (!isConnected) throw new Error("Connect your wallet first.")
      if (chainId !== CREDITCOIN_CHAIN_ID) {
        // The proof is verified on Creditcoin, so that is where the transaction has to go.
        await switchChain?.({ chainId: CREDITCOIN_CHAIN_ID })
      }
      if (!CONTRACT_ADDRESSES.QUEST_ASC) throw new Error("QuestASC address is not configured.")

      setPhase("fetching")
      const proof = await fetchProof(sourceChainKey, sourceTxHash)

      setPhase("signing")
      const hash = await writeContractAsync({
        abi: questAscAbi,
        address: CONTRACT_ASC(),
        functionName: "submit",
        args: [toSubmitArgs(proof), questId],
        chainId: CREDITCOIN_CHAIN_ID,
      })

      setTxHash(hash)
      setPhase("done")
      onClaimed?.(hash)
    } catch (caught) {
      setPhase("idle")
      setError(describeClaimError(caught))
    }
  }, [
    chainId,
    isConnected,
    onClaimed,
    questId,
    sourceChainKey,
    sourceTxHash,
    switchChain,
    writeContractAsync,
  ])

  const busy = phase === "fetching" || phase === "signing"

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={claim}
        disabled={busy || phase === "done"}
        className="w-full rounded bg-sky-500 text-black hover:bg-sky-400"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {phase === "fetching" ? "Fetching the proof…" : "Confirm in your wallet…"}
          </>
        ) : phase === "done" ? (
          <>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Claimed
          </>
        ) : (
          "Claim it yourself"
        )}
      </Button>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Fetches the proof straight from the Attestcoin Proof Builder and submits it from your
        wallet. Vael&apos;s servers are not involved, so this works even if they are down. You pay
        only Creditcoin gas.
      </p>

      {txHash && (
        <a
          href={`https://creditcoin-testnet.blockscout.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-mono text-[11px] text-sky-400 hover:underline"
        >
          {txHash.slice(0, 10)}…{txHash.slice(-6)}
        </a>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function CONTRACT_ASC(): `0x${string}` {
  return CONTRACT_ADDRESSES.QUEST_ASC
}

/**
 * Turn a failure into something a player can act on.
 *
 * The custom errors are declared in the ABI precisely so this can name them: "AlreadyClaimed"
 * means someone already proved this transaction, which is a completely different situation from
 * "your action was too small", and a generic "transaction reverted" would conflate them.
 */
export function describeClaimError(caught: unknown): string {
  if (caught instanceof ProofNotReadyError) return caught.message

  if (caught instanceof BaseError) {
    const reverted = caught.walk((e) => e instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName
      switch (name) {
        case "AlreadyClaimed":
          return "This transaction has already been proved for this quest."
        case "NothingRecognised":
          return "No log in that transaction matches this quest's rule."
        case "SourceBlockTooEarly":
          return "That action happened before you accepted the quest, so it cannot count."
        case "AmountBelowMinimum":
          return "The amount is below the quest's minimum."
        case "PlayerMismatch":
          return "The address in the event is not the wallet assigned to this quest."
        default:
          return name ? `Rejected on-chain: ${name}` : caught.shortMessage
      }
    }
    return caught.shortMessage
  }

  return caught instanceof Error ? caught.message : String(caught)
}

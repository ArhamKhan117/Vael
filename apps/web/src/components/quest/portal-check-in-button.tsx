"use client"

import { useCallback, useState } from "react"
import { useAccount, useSwitchChain, useWriteContract } from "wagmi"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SEPOLIA_CHAIN_ID } from "@/lib/chains"
import { questPortalAbi } from "@/lib/attestcoin/abi"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"

interface PortalCheckInButtonProps {
  questId: bigint
  minAmount: bigint
  onSent?: (txHash: string) => void
}

/**
 * Perform a portal check-in on Sepolia.
 *
 * The value sent is the quest's minimum, because the rule compares against it directly and sending
 * less would produce an action that can never satisfy the quest the player just accepted.
 */
export function PortalCheckInButton({ questId, minAmount, onSent }: PortalCheckInButtonProps) {
  const { isConnected, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      if (!isConnected) throw new Error("Connect your wallet first.")
      if (chainId !== SEPOLIA_CHAIN_ID) {
        await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID })
      }
      const hash = await writeContractAsync({
        abi: questPortalAbi,
        address: CONTRACT_ADDRESSES.QUEST_PORTAL,
        functionName: "checkIn",
        args: [questId],
        value: minAmount > 0n ? minAmount : BigInt(1),
        chainId: SEPOLIA_CHAIN_ID,
      })
      onSent?.(hash)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }, [chainId, isConnected, minAmount, onSent, questId, switchChainAsync, writeContractAsync])

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={send}
        disabled={busy}
        className="w-full rounded bg-white text-black hover:bg-white/90"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Confirm on Sepolia…
          </>
        ) : (
          "Check in on Sepolia"
        )}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

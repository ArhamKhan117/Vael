"use client"

import { useCallback } from "react"
import { useReownWallet } from "./useReownWallet"
import { useWriteContract } from "wagmi"
import { QUEST_MANAGER_ABI, QUEST_MANAGER_ADDRESS } from "@/lib/questManager"

export function useQuestContract() {
  const { wallet, isCreditcoinNetwork } = useReownWallet()
  const { writeContractAsync, isPending, error: writeError } = useWriteContract()

  const acceptQuest = useCallback(
    async (questId: number) => {
      if (!wallet.isConnected || !wallet.address) {
        throw new Error("Wallet not connected")
      }
      if (!isCreditcoinNetwork) {
        throw new Error("Please switch to Creditcoin Testnet")
      }

      const hash = await writeContractAsync({
        address: QUEST_MANAGER_ADDRESS,
        abi: QUEST_MANAGER_ABI,
        functionName: "acceptQuest",
        args: [BigInt(questId)],
      })

      return {
        transactionHash: hash as `0x${string}`,
        success: true,
      }
    },
    [wallet.isConnected, wallet.address, isCreditcoinNetwork, writeContractAsync]
  )

  return {
    acceptQuest,
    loading: isPending,
    error: writeError?.message ?? null,
    isConnected: wallet.isConnected,
    isCreditcoinNetwork,
  }
}

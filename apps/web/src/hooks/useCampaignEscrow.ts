"use client"

import { useCallback, useRef, useEffect } from "react"
import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useAccount,
  useChainId,
} from "wagmi"
import {
  CAMPAIGN_ESCROW_ADDRESS,
  REWARD_TOKEN_ADDRESS,
  CAMPAIGN_ESCROW_ABI,
  ERC20_APPROVE_ABI,
  campaignIdToBytes32,
  parseRewardAmount,
} from "@/lib/campaignEscrow"

const CREDITCOIN_CHAIN_ID = 102031

/** CampaignEscrow: approve the reward token, deposit, read balance. */
export function useCampaignEscrow() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const isCreditcoinNetwork = chainId === CREDITCOIN_CHAIN_ID

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const stateRef = useRef({ hash, isSuccess, writeError })
  useEffect(() => {
    stateRef.current = { hash, isSuccess, writeError }
  }, [hash, isSuccess, writeError])

  /**
   * Wait for tx confirmation. When ignoreHash is set, we wait for a NEW tx
   * (different hash) to confirm - avoids resolving with previous tx's confirmation
   * when approve confirms and we immediately call deposit (hash hasn't updated yet).
   */
  const waitForTx = useCallback(
    (ignoreHash?: `0x${string}`) =>
      new Promise<`0x${string}`>((resolve, reject) => {
        let iv: ReturnType<typeof setInterval> | null = null
        let to: ReturnType<typeof setTimeout> | null = null
        const cleanup = () => {
          if (iv) clearInterval(iv)
          if (to) clearTimeout(to)
          iv = to = null
        }
        const check = () => {
          const { hash: h, isSuccess: ok, writeError: err } = stateRef.current
          if (err) {
            cleanup()
            reject(new Error((err as Error)?.message || "Transaction failed"))
            return true
          }
          if (ok && h) {
            if (ignoreHash && h === ignoreHash) return false
            cleanup()
            resolve(h)
            return true
          }
          return false
        }
        if (check()) return
        iv = setInterval(() => check(), 300)
        to = setTimeout(() => {
          cleanup()
          if (!stateRef.current.isSuccess && !stateRef.current.writeError) {
            reject(new Error("Transaction timeout"))
          }
        }, 120000)
      }),
    []
  )

  const approveRewardToken = useCallback(
    async (amount: number | string) => {
      if (!isConnected || !address) {
        throw new Error("Wallet not connected")
      }
      if (!isCreditcoinNetwork) {
        throw new Error("Please switch to Creditcoin Testnet")
      }
      const amountWei = parseRewardAmount(amount)
      writeContract({
        address: REWARD_TOKEN_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [CAMPAIGN_ESCROW_ADDRESS, amountWei],
      })
      return waitForTx()
    },
    [isConnected, address, isCreditcoinNetwork, writeContract, waitForTx]
  )

  const deposit = useCallback(
    async (campaignId: string, amount: number | string, previousTxHash?: `0x${string}`) => {
      if (!isConnected || !address) {
        throw new Error("Wallet not connected")
      }
      if (!isCreditcoinNetwork) {
        throw new Error("Please switch to Creditcoin Testnet")
      }
      const campaignIdBytes = campaignIdToBytes32(campaignId)
      const amountWei = parseRewardAmount(amount)
      writeContract({
        address: CAMPAIGN_ESCROW_ADDRESS,
        abi: CAMPAIGN_ESCROW_ABI,
        functionName: "deposit",
        args: [campaignIdBytes, amountWei],
      })
      return waitForTx(previousTxHash)
    },
    [isConnected, address, isCreditcoinNetwork, writeContract, waitForTx]
  )

  return {
    approveRewardToken,
    deposit,
    loading: isPending || isConfirming,
    error: (writeError as Error)?.message || null,
    isConnected,
    isCreditcoinNetwork,
    transactionHash: hash,
    campaignIdToBytes32,
  }
}

/** Read campaign balance from escrow */
export function useCampaignBalance(campaignId: string | null) {
  const campaignIdBytes = campaignId ? campaignIdToBytes32(campaignId) : undefined
  const { data, error, isPending, refetch } = useReadContract({
    address: CAMPAIGN_ESCROW_ADDRESS,
    abi: CAMPAIGN_ESCROW_ABI,
    functionName: "campaignBalance",
    args: campaignIdBytes ? [campaignIdBytes] : undefined,
  })
  return {
    balance: data,
    balanceFormatted: data != null ? Number(data) / 1e6 : null,
    error,
    isPending,
    refetch,
  }
}

/** Get deposit amount needed for desired pool (includes 0.5% fee). Falls back to poolAmount if contract has no fee. */
export function useDepositAmountForPool(poolAmount: number) {
  const poolAmountWei = BigInt(Math.floor(poolAmount * 1e6)) // Reward token, 6 decimals
  const { data, error } = useReadContract({
    address: CAMPAIGN_ESCROW_ADDRESS,
    abi: CAMPAIGN_ESCROW_ABI,
    functionName: "getDepositAmountForPool",
    args: poolAmount > 0 ? [poolAmountWei] : undefined,
  })
  const depositAmount = data != null ? Number(data) / 1e6 : poolAmount
  const feeAmount = poolAmount > 0 ? depositAmount - poolAmount : 0
  return {
    depositAmount: data != null ? depositAmount : poolAmount,
    feeAmount,
    feeBps: 50, // 0.5%
    hasFeeSupport: !error && data != null,
  }
}

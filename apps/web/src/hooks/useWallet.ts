"use client"

import { useAccount } from "wagmi"

export function useWallet() {
  const { address, isConnected } = useAccount()

  return {
    address: address || null,
    isConnected: !!isConnected,
  }
}

"use client"

import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi"

import { CREDITCOIN_CHAIN_ID, SEPOLIA_CHAIN_ID } from "@/lib/chains"

/**
 * Wallet state plus network switching.
 *
 * Creditcoin is the game chain: quests, rewards, and proof verification happen there.
 * Sepolia is the source chain players switch to in order to perform the real action.
 */
export function useReownWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const currentChainId = useChainId()
  const { switchChain } = useSwitchChain()

  const switchTo = async (chainId: number, label: string) => {
    if (!switchChain || currentChainId === chainId) return
    try {
      await switchChain({ chainId })
    } catch (error) {
      console.error(`Failed to switch to ${label}:`, error)
    }
  }

  return {
    wallet: {
      address: address || null,
      isConnected,
      chainId: currentChainId,
    },
    connect: (connectorId?: string) => {
      const connector = connectorId
        ? connectors.find((c) => c.id === connectorId)
        : connectors[0]
      if (connector) {
        connect({ connector })
      }
    },
    disconnect,
    connectors,
    isConnecting,
    isCreditcoinNetwork: currentChainId === CREDITCOIN_CHAIN_ID,
    isSepoliaNetwork: currentChainId === SEPOLIA_CHAIN_ID,
    switchToCreditcoin: () => switchTo(CREDITCOIN_CHAIN_ID, "Creditcoin Testnet"),
    switchToSepolia: () => switchTo(SEPOLIA_CHAIN_ID, "Ethereum Sepolia"),
  }
}

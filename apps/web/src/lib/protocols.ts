/**
 * Protocol shape as served by the API. The registry itself lives in the backend
 * (`apps/api/src/lib/protocols.ts`); this mirrors just enough to render it.
 */
export interface Protocol {
  key: string
  name: string
  chain: "sepolia" | "creditcoin"
  chainId: number
  /** Attestcoin source chain key. Only source chains have one. */
  attestcoinChainKey?: number
  evmAddress: string
  category: "swap" | "liquidity" | "stake" | "lend" | "portal"
  website: string
  description: string
  emitterAddresses?: string[]
}

export function getProtocolByAddress(address: string, protocols: Protocol[]): Protocol | null {
  const normalized = address?.toLowerCase()
  if (!normalized) return null
  return (
    protocols.find(
      (protocol) =>
        protocol.evmAddress?.toLowerCase() === normalized ||
        protocol.emitterAddresses?.some((emitter) => emitter?.toLowerCase() === normalized)
    ) ?? null
  )
}

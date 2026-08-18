import { defineChain } from "viem"
import { sepolia } from "viem/chains"

import { env } from "../config/env"

/**
 * Creditcoin testnet. All Vael game state, rewards, and proof verification live here.
 */
export const creditcoinTestnet = defineChain({
  id: 102031,
  name: "Creditcoin Testnet",
  nativeCurrency: { decimals: 18, name: "Creditcoin", symbol: "tCTC" },
  rpcUrls: {
    default: { http: [env.CREDITCOIN_RPC_URL, ...env.CREDITCOIN_RPC_FALLBACK_URLS] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://creditcoin-testnet.blockscout.com" },
  },
})

/**
 * Ethereum Sepolia. Source chain for the DeFi actions players prove.
 */
export const sepoliaChain = sepolia

export const CREDITCOIN_RPC_URLS = [env.CREDITCOIN_RPC_URL, ...env.CREDITCOIN_RPC_FALLBACK_URLS]
export const SEPOLIA_RPC_URLS = [env.SEPOLIA_RPC_URL, ...env.SEPOLIA_RPC_FALLBACK_URLS]

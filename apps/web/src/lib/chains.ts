import { defineChain } from "viem"
import { sepolia } from "viem/chains"

/** Comma-separated env list, tried in order after the primary endpoint. */
function urlList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
}

/**
 * An env var that exists but is empty is not a value.
 *
 * `??` only catches undefined, so a blank `NEXT_PUBLIC_CREDITCOIN_RPC_URL` in a .env file put an
 * empty string at the head of the transport list. viem's `http("")` throws, which failed a
 * prerender, and every read built on that list silently gave up.
 */
function orDefault(value: string | undefined, fallbackUrl: string): string {
  const trimmed = (value ?? "").trim()
  return trimmed.length > 0 ? trimmed : fallbackUrl
}

const CREDITCOIN_RPC_URL = orDefault(
  process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL,
  "https://rpc.cc3-testnet.creditcoin.network"
)

export const CREDITCOIN_RPC_URLS = [
  CREDITCOIN_RPC_URL,
  ...urlList(process.env.NEXT_PUBLIC_CREDITCOIN_RPC_FALLBACK_URLS),
]

export const SEPOLIA_RPC_URLS = [
  ...urlList(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  ...urlList(process.env.NEXT_PUBLIC_SEPOLIA_RPC_FALLBACK_URLS),
  "https://ethereum-sepolia-rpc.publicnode.com",
]

export const CREDITCOIN_CHAIN_ID = 102031
export const SEPOLIA_CHAIN_ID = 11155111

export const CREDITCOIN_EXPLORER_URL = "https://creditcoin-testnet.blockscout.com"
export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io"

/** Creditcoin testnet. Default network: all Vael game state and rewards live here. */
export const creditcoinTestnet = defineChain({
  id: CREDITCOIN_CHAIN_ID,
  name: "Creditcoin Testnet",
  nativeCurrency: { decimals: 18, name: "Creditcoin", symbol: "tCTC" },
  rpcUrls: {
    default: { http: CREDITCOIN_RPC_URLS },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: CREDITCOIN_EXPLORER_URL },
  },
  testnet: true,
})

/** Ethereum Sepolia. Source chain for the DeFi actions players prove. */
export const sepoliaChain = sepolia

/** Explorer link for a transaction on either chain. */
export function explorerTxUrl(chainId: number, txHash: string): string {
  const base = chainId === SEPOLIA_CHAIN_ID ? SEPOLIA_EXPLORER_URL : CREDITCOIN_EXPLORER_URL
  return `${base}/tx/${txHash}`
}

/** Explorer link for an address on either chain. */
export function explorerAddressUrl(chainId: number, address: string): string {
  const base = chainId === SEPOLIA_CHAIN_ID ? SEPOLIA_EXPLORER_URL : CREDITCOIN_EXPLORER_URL
  return `${base}/address/${address}`
}

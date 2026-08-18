import { createAppKit } from "@reown/appkit/react"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { fallback, http } from "viem"

import {
  CREDITCOIN_CHAIN_ID,
  CREDITCOIN_RPC_URLS,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_RPC_URLS,
  creditcoinTestnet,
  sepoliaChain,
} from "./chains"

const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "YOUR_PROJECT_ID"

/**
 * Public RPC endpoints reject JSON-RPC batching and rate-limit hard, so every transport
 * batches nothing and falls through a list of endpoints.
 */
function rpcTransport(urls: string[]) {
  return fallback(urls.map((url) => http(url, { batch: false, retryCount: 2 })))
}

const networks = [creditcoinTestnet, sepoliaChain] as const

export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  networks: [...networks],
  projectId,
  transports: {
    [CREDITCOIN_CHAIN_ID]: rpcTransport(CREDITCOIN_RPC_URLS),
    [SEPOLIA_CHAIN_ID]: rpcTransport(SEPOLIA_RPC_URLS),
  },
})

/** Metadata URL, resolved on the client to avoid an SSR hydration mismatch. */
const getMetadataUrl = () => {
  if (typeof window !== "undefined") return window.location.origin
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"
}

export const metadata = {
  name: "Vael",
  description:
    "Do real DeFi on Ethereum. Prove it on Creditcoin with Attestcoin. Earn rewards no backend can fake.",
  url: getMetadataUrl(),
  icons: ["/logo/vael.svg"],
}

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [...networks],
  projectId,
  defaultNetwork: creditcoinTestnet,
  metadata,
  features: {
    analytics: false,
  },
  themeVariables: {
    "--w3m-accent": "#ffffff",
    "--w3m-border-radius-master": "8px",
  },
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

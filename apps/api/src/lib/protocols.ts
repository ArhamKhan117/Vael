/**
 * Protocol registry.
 *
 * Sepolia entries are the source-chain protocols players act on; their addresses are the
 * emitters QuestASC allowlists when it decodes a proof. Creditcoin entries are native
 * protocols reachable directly on the game chain.
 *
 * Addresses come from docs/SPEC.md section 3.3. Re-verify against the official deployment
 * pages before registering a new verification rule.
 */

export type ProtocolCategory = "swap" | "liquidity" | "stake" | "lend" | "portal"

export type ChainKey = "sepolia" | "creditcoin"

export interface Protocol {
  /** Registry key, stable across renames. */
  key: string
  name: string
  chain: ChainKey
  /** EVM chain id: 11155111 Sepolia, 102031 Creditcoin testnet. */
  chainId: number
  /** Attestcoin source chain key. Only source chains have one. */
  attestcoinChainKey?: number
  /** Primary contract address used when creating a quest on-chain. */
  evmAddress: string
  category: ProtocolCategory
  website: string
  description: string
  /**
   * Every contract whose logs may satisfy a quest for this protocol. QuestASC checks the
   * emitting log address against this set, never the transaction `from` field.
   */
  emitterAddresses: string[]
}

export const CREDITCOIN_TESTNET_CHAIN_ID = 102031
export const SEPOLIA_CHAIN_ID = 11155111
/** Attestcoin source chain keys. */
export const SEPOLIA_CHAIN_KEY = 1
export const ETHEREUM_MAINNET_CHAIN_KEY = 3

/** Sepolia token addresses referenced by quest rules. */
export const SEPOLIA_TOKENS = {
  WETH9: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  AAVE_USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
  AAVE_DAI: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357",
  AAVE_WETH: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c",
  AAVE_LINK: "0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5",
} as const

/**
 * QuestPortal on Sepolia. Unset until it is deployed; until then no portal quest can be
 * created, which is intentional.
 */
/**
 * Symbol and decimals for the tokens a quest rule can name.
 *
 * A rule's minimum is stored in the token's own units, so "200000" is 0.2 USDC and 0.000000000002
 * of anything with eighteen decimals. Showing the raw number tells a player nothing.
 */
export const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  [SEPOLIA_TOKENS.WETH9.toLowerCase()]: { symbol: "WETH", decimals: 18 },
  [SEPOLIA_TOKENS.USDC.toLowerCase()]: { symbol: "USDC", decimals: 6 },
  [SEPOLIA_TOKENS.AAVE_USDC.toLowerCase()]: { symbol: "aUSDC", decimals: 6 },
  [SEPOLIA_TOKENS.AAVE_DAI.toLowerCase()]: { symbol: "aDAI", decimals: 18 },
  [SEPOLIA_TOKENS.AAVE_WETH.toLowerCase()]: { symbol: "aWETH", decimals: 18 },
  [SEPOLIA_TOKENS.AAVE_LINK.toLowerCase()]: { symbol: "aLINK", decimals: 18 },
  // Creditcoin, for the native actions. A native rule names one of these or no token at all, and
  // without them a rule minimum was printed as its raw 18-decimal integer followed by "units".
  ...(process.env.PENGUINSWAP_WCTC_ADDRESS
    ? { [process.env.PENGUINSWAP_WCTC_ADDRESS.toLowerCase()]: { symbol: "WCTC", decimals: 18 } }
    : {}),
  ...(process.env.PENGUINSWAP_USD1_ADDRESS
    ? { [process.env.PENGUINSWAP_USD1_ADDRESS.toLowerCase()]: { symbol: "USD1", decimals: 18 } }
    : {}),
}

/** What a token is called and how it is scaled, or nothing when the address is unknown. */
export function tokenInfo(address: string): { symbol: string; decimals: number } | undefined {
  return TOKEN_INFO[address.toLowerCase()]
}

export const QUEST_PORTAL_PLACEHOLDER = "0x0000000000000000000000000000000000000000"

export const PROTOCOLS: Record<string, Protocol> = {
  QUEST_PORTAL: {
    key: "QUEST_PORTAL",
    name: "Vael Quest Portal",
    chain: "sepolia",
    chainId: SEPOLIA_CHAIN_ID,
    attestcoinChainKey: SEPOLIA_CHAIN_KEY,
    evmAddress: QUEST_PORTAL_PLACEHOLDER,
    category: "portal",
    website: "https://sepolia.etherscan.io",
    description:
      "Vael's own source-chain contract. Emits QuestActionPerformed for check-ins and deposits.",
    emitterAddresses: [QUEST_PORTAL_PLACEHOLDER],
  },
  UNISWAP_V3: {
    key: "UNISWAP_V3",
    name: "Uniswap v3",
    chain: "sepolia",
    chainId: SEPOLIA_CHAIN_ID,
    attestcoinChainKey: SEPOLIA_CHAIN_KEY,
    evmAddress: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    category: "swap",
    website: "https://app.uniswap.org",
    description: "Token swaps on Ethereum Sepolia. Swap events are emitted by the pool, not the router.",
    // The router is where players transact; the pools are what QuestASC allowlists as
    // emitters. Pool addresses are registered per token pair as quests are created.
    emitterAddresses: [
      "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", // SwapRouter02
      "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b", // UniversalRouter
      "0x0227628f3F023bb0B980b67D528571c95c6DaC1c", // v3 Factory
    ],
  },
  AAVE_V3: {
    key: "AAVE_V3",
    name: "Aave v3",
    chain: "sepolia",
    chainId: SEPOLIA_CHAIN_ID,
    attestcoinChainKey: SEPOLIA_CHAIN_KEY,
    evmAddress: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
    category: "lend",
    website: "https://app.aave.com",
    description: "Supply and borrow on Ethereum Sepolia. Supply and Borrow events come from the Pool.",
    emitterAddresses: [
      "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951", // Pool
      "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A", // PoolAddressesProvider
    ],
  },
  ERC20_TRANSFER: {
    key: "ERC20_TRANSFER",
    name: "ERC-20 Transfer",
    chain: "sepolia",
    chainId: SEPOLIA_CHAIN_ID,
    attestcoinChainKey: SEPOLIA_CHAIN_KEY,
    evmAddress: SEPOLIA_TOKENS.USDC,
    category: "swap",
    website: "https://sepolia.etherscan.io",
    description: "Plain ERC-20 transfers of an allowlisted token on Ethereum Sepolia.",
    emitterAddresses: [
      SEPOLIA_TOKENS.USDC,
      SEPOLIA_TOKENS.WETH9,
      SEPOLIA_TOKENS.AAVE_USDC,
      SEPOLIA_TOKENS.AAVE_DAI,
    ],
  },
  PENGUINSWAP: {
    key: "PENGUINSWAP",
    name: "PenguinSwap",
    chain: "creditcoin",
    chainId: CREDITCOIN_TESTNET_CHAIN_ID,
    evmAddress: "0x0000000000000000000000000000000000000000",
    category: "swap",
    website: "https://creditcoin.org/blog/penguinswap-is-live-on-testnet/",
    description:
      "Native DEX on Creditcoin testnet. Quests here run on the game chain and need no cross-chain proof.",
    emitterAddresses: [],
  },
}

/** Look up a protocol by any address it may emit from. Case-insensitive. */
export function getProtocolByAddress(address: string): Protocol | null {
  const normalized = address.toLowerCase()
  return (
    Object.values(PROTOCOLS).find(
      (protocol) =>
        protocol.evmAddress.toLowerCase() === normalized ||
        protocol.emitterAddresses.some((emitter) => emitter.toLowerCase() === normalized)
    ) ?? null
  )
}

/** The address recorded on-chain when a quest for this protocol is created. */
export function getProtocolRouterAddress(address: string): string {
  return getProtocolByAddress(address)?.evmAddress ?? address
}

export function getProtocolByKey(key: string): Protocol | null {
  return PROTOCOLS[key] ?? null
}

export function getAllProtocols(): Protocol[] {
  return Object.values(PROTOCOLS)
}

export function getProtocolsByCategory(category: ProtocolCategory): Protocol[] {
  return Object.values(PROTOCOLS).filter((protocol) => protocol.category === category)
}

export function getProtocolsByChain(chain: ChainKey): Protocol[] {
  return Object.values(PROTOCOLS).filter((protocol) => protocol.chain === chain)
}

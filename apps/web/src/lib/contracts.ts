/**
 * Deployed contract addresses.
 *
 * Everything except QUEST_PORTAL lives on Creditcoin testnet. QUEST_PORTAL is the one
 * contract Vael owns on Ethereum Sepolia.
 * Addresses are recorded in docs/ADDRESSES.md.
 */

const address = (value: string | undefined): `0x${string}` => (value || "") as `0x${string}`

export const CONTRACT_ADDRESSES = {
  // Creditcoin testnet
  VAEL_TOKEN: address(process.env.NEXT_PUBLIC_VAEL_TOKEN_ADDRESS),
  BADGE_NFT: address(process.env.NEXT_PUBLIC_BADGE_NFT_ADDRESS),
  QUEST_MANAGER: address(process.env.NEXT_PUBLIC_QUEST_MANAGER_ADDRESS),
  CAMPAIGN_ESCROW: address(process.env.NEXT_PUBLIC_CAMPAIGN_ESCROW_ADDRESS),
  QUEST_ASC: address(process.env.NEXT_PUBLIC_QUEST_ASC_ADDRESS),
  VAEL_HERO: address(process.env.NEXT_PUBLIC_VAEL_HERO_ADDRESS),
  RAID_BOSS: address(process.env.NEXT_PUBLIC_RAID_BOSS_ADDRESS),
  ARENA: address(process.env.NEXT_PUBLIC_ARENA_ADDRESS),
  LOOT: address(process.env.NEXT_PUBLIC_LOOT_ADDRESS),
  EQUIPMENT: address(process.env.NEXT_PUBLIC_EQUIPMENT_ADDRESS),
  MARKETPLACE: address(process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS),
  /** ERC-20 a partner funds a campaign with. */
  REWARD_STABLE: address(process.env.NEXT_PUBLIC_REWARD_STABLE_ADDRESS),
  /** The second completion path: it performs a Creditcoin action rather than verifying a claim. */
  NATIVE_PORTAL: address(process.env.NEXT_PUBLIC_NATIVE_PORTAL_ADDRESS),

  // Ethereum Sepolia
  QUEST_PORTAL: address(process.env.NEXT_PUBLIC_QUEST_PORTAL_ADDRESS),
} as const

/**
 * PenguinSwap on Creditcoin testnet, discovered on chain and recorded in docs/SPEC.md section 3.1a.
 *
 * There is exactly one pair with real liquidity, WCTC/USD1 at the 0.05% tier, so a native swap
 * quest trades against that one. Naming it here rather than guessing per quest keeps the panel from
 * routing a player into a pool that cannot fill them.
 */
export const PENGUINSWAP = {
  ROUTER: address(process.env.NEXT_PUBLIC_PENGUINSWAP_ROUTER_ADDRESS),
  WCTC: address(process.env.NEXT_PUBLIC_PENGUINSWAP_WCTC_ADDRESS),
  USD1: address(process.env.NEXT_PUBLIC_PENGUINSWAP_USD1_ADDRESS),
  POOL_WCTC_USD1: address(process.env.NEXT_PUBLIC_PENGUINSWAP_POOL_WCTC_USD1_500),
  /** Hundredths of a basis point, matching the pool above. */
  FEE: 500,
} as const

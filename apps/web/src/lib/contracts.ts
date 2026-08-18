/**
 * Deployed contract addresses.
 *
 * Everything except QUEST_PORTAL lives on Creditcoin testnet. QUEST_PORTAL is the one
 * contract Vael owns on Ethereum Sepolia, and it lands in milestone 3.
 * Addresses are recorded in docs/ADDRESSES.md as each is deployed.
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
  /** ERC-20 a partner funds a campaign with. */
  REWARD_STABLE: address(process.env.NEXT_PUBLIC_REWARD_STABLE_ADDRESS),

  // Ethereum Sepolia
  QUEST_PORTAL: address(process.env.NEXT_PUBLIC_QUEST_PORTAL_ADDRESS),
} as const

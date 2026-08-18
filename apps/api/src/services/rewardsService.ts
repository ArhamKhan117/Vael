import { env } from "../config/env"

const rewardVaultAddress = env.REWARD_VAULT_ADDRESS.toLowerCase()
const badgeNftAddress = env.BADGE_NFT_ADDRESS.toLowerCase()

export interface OnChainReward {
  questId: number
  vaelAmount: string // VAEL amount, 18 decimals
  badgeTokenId?: number | undefined
  badgeLevel?: number | undefined
  badgeImageUri?: string | undefined
  transactionHash: string
  timestamp?: number | undefined
}

/**
 * Get badge NFT metadata URI from IPFS
 */
async function getBadgeMetadata(badgeLevel: number): Promise<string | null> {
  try {
    // For now, we'll return IPFS URI based on badge level
    // These should match the CIDs set in BadgeNFT contract
    const badgeURIs: Record<number, string> = {
      1: "ipfs://bafkreihpk4e7are4vy2ta2jjykezijqwnhi2mrflr6bxnhn4o36isudahq",
      2: "ipfs://bafkreihvru352dw5b4qyslzvkcsf5qm7cw3k3y262gcq4e4evvbqzulf6q",
      3: "ipfs://bafkreic6lhhm4j62em3jzepbqg3ughcpv7izovujxvjvq4qy6u7qauhwoq",
      4: "ipfs://bafkreigzbzacffjlnermzlnynei552tf3djuxgsixsro4hvmpcuyohonf4",
      5: "ipfs://bafkreihmqr3haexn5wmktsfhejotpwwpuc7urnr3cvi7h3p57ggz2dns2i",
      6: "ipfs://bafkreidhrxrkkca5livv7zr6r4dvoexgyg4i2t4mw4t5qpdf2a6hlfezra",
      7: "ipfs://bafkreiagxgdvyvxv5rop66gtuvkzgaw4pei2zph2lxb24kxne4bfmfbsle",
      8: "ipfs://bafkreibwqzpefyq3gdj3mqt53m6yqrt2ttwa37osx7qnp44prcfjdcd3mq",
      9: "ipfs://bafkreighkh6ww4u3354ja6xx4ahct7n2lx6ba3blimfff4g5s2mgox3u2q",
      10: "ipfs://bafkreie5qf24hp4xm7l2gjbjkjr4re7ubs7uoqm6sxo3wkyri3kbghi2qe",
    }

    return badgeURIs[badgeLevel] || null
  } catch (error) {
    console.error("Failed to get badge metadata:", error)
    return null
  }
}

/**
 * Convert IPFS URI to HTTP gateway URL
 */
function ipfsToHttp(ipfsUri: string): string {
  if (ipfsUri.startsWith("ipfs://")) {
    const cid = ipfsUri.replace("ipfs://", "")
    return `https://ipfs.io/ipfs/${cid}`
  }
  return ipfsUri
}

/**
 * Get all rewards (VAEL + badges) for a user from the database (tracked in user_xp_ledger)
 * This is more reliable than querying on-chain events directly
 * We'll combine with quest metadata and badge NFT info
 */
export async function getUserRewardsFromChain(walletAddress: string): Promise<OnChainReward[]> {
  const normalizedAddress = walletAddress.toLowerCase()

  try {
    // Read from the indexed cache rather than replaying Creditcoin logs on every request.
    // which already tracks completed quests and rewards
    // We'll enhance it with badge NFT metadata from IPFS
    const { supabase } = await import("../lib/supabase.js")

    // Get XP ledger entries that have completion_tx_hash (completed quests)
    // Also get quest details to fallback to reward_per_participant if reward_amount is null
    const { data: xpEntries, error: xpError } = await supabase
      .from("user_xp_ledger")
      .select("quest_id_on_chain, reward_amount, badge_token_id, completion_tx_hash, created_at")
      .eq("wallet_address", normalizedAddress)
      .not("completion_tx_hash", "is", null)
      .order("created_at", { ascending: false })

    if (xpError) {
      console.error("Failed to get XP entries:", xpError)
      throw new Error(`Failed to get rewards from database: ${xpError.message}`)
    }

    if (!xpEntries || xpEntries.length === 0) {
      return []
    }

    // Get quest details for badge level and reward amount fallback
    const questIds = xpEntries.map((e: any) => e.quest_id_on_chain)
    const { data: quests } = await supabase
      .from("quests")
      .select("quest_id_on_chain, title, badge_level, reward_per_participant")
      .in("quest_id_on_chain", questIds)

    // Map rewards with badge info
    const rewards: OnChainReward[] = []

    for (const entry of xpEntries) {
      const quest = quests?.find((q: any) => q.quest_id_on_chain === entry.quest_id_on_chain)
      const badgeLevel = quest?.badge_level || entry.badge_token_id ? 1 : undefined

      // reward_amount is stored as NUMERIC in the database (VAEL amount, not wei)
      // Fallback to reward_per_participant from quest if reward_amount is null
      let rewardAmountStr = "0"
      
      // Try reward_amount first
      if (entry.reward_amount !== null && entry.reward_amount !== undefined && entry.reward_amount !== "0") {
        rewardAmountStr = typeof entry.reward_amount === "string" 
          ? entry.reward_amount 
          : String(entry.reward_amount)
      } else if (quest?.reward_per_participant) {
        // Fallback to quest's reward_per_participant if reward_amount is null/zero
        const fallbackAmount = typeof quest.reward_per_participant === "string"
          ? quest.reward_per_participant
          : String(quest.reward_per_participant)
        if (fallbackAmount && fallbackAmount !== "0") {
          rewardAmountStr = fallbackAmount
        }
      }

      // Debug logging
      console.log(`Quest ${entry.quest_id_on_chain}: reward_amount=${entry.reward_amount} (type: ${typeof entry.reward_amount}), fallback=${quest?.reward_per_participant}, final=${rewardAmountStr}`)

      if (badgeLevel) {
        // Get badge metadata URI
        const badgeUri = await getBadgeMetadata(badgeLevel)
        const reward: OnChainReward = {
          questId: entry.quest_id_on_chain,
          vaelAmount: rewardAmountStr, // VAEL, not wei, straight from the database
          badgeLevel,
          badgeImageUri: badgeUri ? ipfsToHttp(badgeUri) : undefined,
          transactionHash: entry.completion_tx_hash || "",
          timestamp: new Date(entry.created_at).getTime() / 1000,
        }
        if (entry.badge_token_id) {
          reward.badgeTokenId = Number(entry.badge_token_id)
        }
        rewards.push(reward)
      } else {
        // VAEL reward without a badge
        rewards.push({
          questId: entry.quest_id_on_chain,
          vaelAmount: rewardAmountStr,
          transactionHash: entry.completion_tx_hash || "",
          timestamp: new Date(entry.created_at).getTime() / 1000,
        })
      }
    }

    return rewards.sort((a, b) => {
      // Sort by timestamp (newest first)
      const timeA = a.timestamp || 0
      const timeB = b.timestamp || 0
      return timeB - timeA
    })
  } catch (error) {
    console.error("Failed to get rewards:", error)
    throw new Error(`Failed to query rewards: ${error instanceof Error ? error.message : String(error)}`)
  }
}

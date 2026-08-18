import { generateQuestWithGroq } from "./aiQuestGenerator"
import {
  saveQuest,
  getQuestByOnChainId,
  getOrCreateUser,
  getExpiredDailyWeeklyQuests,
  markQuestExpired,
} from "./dbService"
import { env } from "../config/env"
import { PROTOCOLS } from "../lib/protocols"

const QUEST_GENERATION_RETRY_COUNT = 3
const QUEST_GENERATION_RETRY_DELAY_MS = 2000

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? QUEST_GENERATION_RETRY_COUNT
  const delayMs = opts.delayMs ?? QUEST_GENERATION_RETRY_DELAY_MS
  const label = opts.label ?? "operation"
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      if (attempt < maxAttempts) {
        console.warn(`[Retry] ${label} failed (attempt ${attempt}/${maxAttempts}):`, error.message)
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }
  throw lastError
}

/**
 * Generate daily quest for user
 * Daily quests are simpler, smaller rewards, expire in 24 hours
 */
export async function generateDailyQuest(walletAddress: string) {
  // Get a random protocol for variety
  // Use wallet address + timestamp to ensure variety per user and per generation
  const protocols = Object.values(PROTOCOLS)
  if (protocols.length === 0) {
    throw new Error("No protocols available")
  }
  
  // Use crypto.randomInt if available, otherwise use Math.random with better seed
  let protocolIndex: number
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Use crypto for better randomness
    const randomArray = new Uint32Array(1)
    crypto.getRandomValues(randomArray)
    protocolIndex = Number(randomArray[0]) % protocols.length
  } else {
    // Fallback to Math.random with seed based on wallet + timestamp
    const timestamp = Date.now()
    const addressHash = walletAddress.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    // Mix with Math.random for better distribution
    const randomValue = Math.random()
    protocolIndex = Math.floor((addressHash + timestamp + randomValue * 1000) % protocols.length)
  }
  
  // Ensure index is valid
  if (protocolIndex < 0 || protocolIndex >= protocols.length || isNaN(protocolIndex)) {
    protocolIndex = 0 // Fallback to first protocol
  }
  
  const protocol = protocols[protocolIndex]
  if (!protocol) {
    throw new Error(`Failed to select protocol at index ${protocolIndex}`)
  }
  
  console.log(`[Daily Quest] Selected protocol: ${protocol.name} (${protocol.category}) for ${walletAddress.slice(0, 6)}...`)

  // Calculate expiry: 24 hours from now
  const expiryTimestamp = Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours

  // Generate quest with AI
  const result = await generateQuestWithGroq({
    projectName: "Vael",
    goal: `Complete a ${protocol.category} action on ${protocol.name} on Ethereum Sepolia. Daily quest to earn rewards and XP.`,
    chain: "Ethereum Sepolia",
    protocol: protocol.evmAddress,
    participant: walletAddress,
    rewardAmount: "50", // Smaller reward for daily (50 VAEL)
    badgeLevel: 1,
    autoDeploy: true,
    categoryHint: protocol.category as "swap" | "liquidity" | "stake" | "lend",
    expiry: expiryTimestamp,
    extraNotes: `This is a daily quest. Complete it within 24 hours to earn rewards. Difficulty should be easy to medium.`,
    questType: "daily", // Mark as daily quest
  })

  if (!result.onChainResult) {
    throw new Error("Failed to deploy daily quest on-chain")
  }

  const questIdOnChain = Number(result.onChainResult.questId)

  // Quest type is already set during saveQuest in aiQuestGenerator via questType parameter
  // No need to update manually

  return {
    questId: questIdOnChain,
    transactionHash: result.onChainResult.transactionHash,
    questDraft: result.questDraft,
  }
}

/**
 * Generate weekly quest for user
 * Weekly quests are more complex, larger rewards, expire in 7 days
 */
export async function generateWeeklyQuest(walletAddress: string) {
  // Get a random protocol for variety
  // Try to select a different protocol than the daily quest for variety
  const protocols = Object.values(PROTOCOLS)
  if (protocols.length === 0) {
    throw new Error("No protocols available")
  }
  
  // Use crypto.randomInt if available, otherwise use Math.random with better seed
  // Offset calculation to potentially get different protocol than daily
  let protocolIndex: number
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Use crypto for better randomness
    const randomArray = new Uint32Array(1)
    crypto.getRandomValues(randomArray)
    protocolIndex = Number(randomArray[0]) % protocols.length
  } else {
    // Fallback to Math.random with seed based on wallet + timestamp
    // Use different offset for weekly to increase chance of different protocol
    const timestamp = Date.now()
    const addressHash = walletAddress.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    // Mix with Math.random for better distribution, offset by 999 for variety
    const randomValue = Math.random()
    protocolIndex = Math.floor((addressHash + timestamp + randomValue * 1000 + 999) % protocols.length)
  }
  
  // Ensure index is valid
  if (protocolIndex < 0 || protocolIndex >= protocols.length || isNaN(protocolIndex)) {
    protocolIndex = protocols.length > 1 ? 1 : 0 // Fallback to second protocol if available, otherwise first
  }
  
  const protocol = protocols[protocolIndex]
  if (!protocol) {
    throw new Error(`Failed to select protocol at index ${protocolIndex}`)
  }
  
  console.log(`[Weekly Quest] Selected protocol: ${protocol.name} (${protocol.category}) for ${walletAddress.slice(0, 6)}...`)

  // Calculate expiry: 7 days from now
  const expiryTimestamp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days

  // Generate quest with AI
  const result = await generateQuestWithGroq({
    projectName: "Vael",
    goal: `Complete an advanced ${protocol.category} action on ${protocol.name} on Ethereum Sepolia. Weekly quest with better rewards for experienced users.`,
    chain: "Ethereum Sepolia",
    protocol: protocol.evmAddress,
    participant: walletAddress,
    rewardAmount: "200", // Larger reward for weekly (200 VAEL)
    badgeLevel: 2, // Higher badge level for weekly
    autoDeploy: true,
    categoryHint: protocol.category as "swap" | "liquidity" | "stake" | "lend",
    expiry: expiryTimestamp,
    extraNotes: `This is a weekly quest. Complete it within 7 days to earn better rewards. Difficulty should be medium to hard.`,
    questType: "weekly", // Mark as weekly quest
  })

  if (!result.onChainResult) {
    throw new Error("Failed to deploy weekly quest on-chain")
  }

  const questIdOnChain = Number(result.onChainResult.questId)

  // Quest type is already set during saveQuest in aiQuestGenerator via questType parameter
  // No need to update manually

  return {
    questId: questIdOnChain,
    transactionHash: result.onChainResult.transactionHash,
    questDraft: result.questDraft,
  }
}

/**
 * Generate initial daily and weekly quests for a new user
 */
export async function generateInitialQuests(walletAddress: string) {
  // Ensure user exists
  await getOrCreateUser(walletAddress)

  // Check if user already has active quests (idempotency check)
  const existingQuests = await getUserActiveQuests(walletAddress)
  if (existingQuests.daily && existingQuests.weekly) {
    // User already has both quests, skip generation
    return {
      daily: existingQuests.daily
        ? { questId: existingQuests.daily.quest_id_on_chain, transactionHash: "" }
        : undefined,
      weekly: existingQuests.weekly
        ? { questId: existingQuests.weekly.quest_id_on_chain, transactionHash: "" }
        : undefined,
      errors: {},
    }
  }

  const results: {
    daily?: { questId: number; transactionHash: string }
    weekly?: { questId: number; transactionHash: string }
    errors?: { daily?: string; weekly?: string }
  } = {
    errors: {},
  }

  // Generate daily quest only if doesn't exist
  if (!existingQuests.daily) {
    try {
      const dailyResult = await withRetry(
        () => generateDailyQuest(walletAddress),
        { label: `daily quest for ${walletAddress.slice(0, 8)}...` }
      )
      results.daily = {
        questId: dailyResult.questId,
        transactionHash: dailyResult.transactionHash,
      }
    } catch (error: any) {
      console.error("Failed to generate daily quest (after retries):", error)
      results.errors = { ...results.errors, daily: error.message }
    }
  } else {
    // Return existing daily quest
    results.daily = {
      questId: existingQuests.daily.quest_id_on_chain,
      transactionHash: "",
    }
  }

  // Generate weekly quest only if doesn't exist
  if (!existingQuests.weekly) {
    try {
      const weeklyResult = await withRetry(
        () => generateWeeklyQuest(walletAddress),
        { label: `weekly quest for ${walletAddress.slice(0, 8)}...` }
      )
      results.weekly = {
        questId: weeklyResult.questId,
        transactionHash: weeklyResult.transactionHash,
      }
    } catch (error: any) {
      console.error("Failed to generate weekly quest (after retries):", error)
      results.errors = { ...results.errors, weekly: error.message }
    }
  } else {
    // Return existing weekly quest
    results.weekly = {
      questId: existingQuests.weekly.quest_id_on_chain,
      transactionHash: "",
    }
  }

  return results
}

/**
 * Process expired daily/weekly quests — triggered by expiry, not by schedule.
 * For each expired quest: mark as expired, then generate a new one for that user.
 * Call this from a periodic job; the "trigger" is the expired state, not the clock.
 */
export async function processExpiredQuests(): Promise<{
  processed: number
  daily: { success: number; failed: number }
  weekly: { success: number; failed: number }
}> {
  const expiredQuests = await getExpiredDailyWeeklyQuests()
  if (expiredQuests.length === 0) {
    return { processed: 0, daily: { success: 0, failed: 0 }, weekly: { success: 0, failed: 0 } }
  }

  const stats = { processed: 0, daily: { success: 0, failed: 0 }, weekly: { success: 0, failed: 0 } }

  // Group by wallet + quest_type (one expired daily and one expired weekly per user max)
  const byUser = new Map<string, { daily?: (typeof expiredQuests)[0]; weekly?: (typeof expiredQuests)[0] }>()
  for (const q of expiredQuests) {
    const wallet = (q.assigned_participant || "").toLowerCase()
    if (!wallet) continue
    const entry = byUser.get(wallet) || {}
    if (q.quest_type === "daily") entry.daily = q
    else if (q.quest_type === "weekly") entry.weekly = q
    byUser.set(wallet, entry)
  }

  for (const [walletAddress, entry] of byUser) {
    if (entry.daily) {
      try {
        await withRetry(
          () => generateDailyQuest(walletAddress),
          { label: `daily for ${walletAddress.slice(0, 8)}...` }
        )
        await markQuestExpired(entry.daily.quest_id_on_chain)
        stats.daily.success++
        stats.processed++
      } catch (error: any) {
        console.error(`[processExpiredQuests] Failed daily for ${walletAddress} (after retries):`, error.message)
        stats.daily.failed++
      }
    }
    if (entry.weekly) {
      try {
        await withRetry(
          () => generateWeeklyQuest(walletAddress),
          { label: `weekly for ${walletAddress.slice(0, 8)}...` }
        )
        await markQuestExpired(entry.weekly.quest_id_on_chain)
        stats.weekly.success++
        stats.processed++
      } catch (error: any) {
        console.error(`[processExpiredQuests] Failed weekly for ${walletAddress} (after retries):`, error.message)
        stats.weekly.failed++
      }
    }
  }

  return stats
}

/**
 * Check if user has active daily/weekly quests
 */
export async function getUserActiveQuests(walletAddress: string) {
  try {
    const { supabase } = await import("../lib/supabase.js")
    
    const { data, error } = await supabase
      .from("quests")
      .select("*")
      .eq("assigned_participant", walletAddress.toLowerCase())
      .in("quest_type", ["daily", "weekly"])
      .in("status", ["active"])
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error getting user quests:", error)
      throw new Error(`Failed to get user quests: ${error.message}`)
    }

    const daily = data?.find((q: any) => q.quest_type === "daily")
    const weekly = data?.find((q: any) => q.quest_type === "weekly")

    return {
      daily: daily || null,
      weekly: weekly || null,
      all: data || [],
    }
  } catch (error: any) {
    // If fetch fails (e.g., Supabase connection issue), return empty but don't crash
    console.error("Error in getUserActiveQuests:", error)
    return {
      daily: null,
      weekly: null,
      all: [],
    }
  }
}


import { Router } from "express"

import { getParticipantProgress, getQuestById } from "../services/questService"
import { getLeaderboard, getUserStats, getOrCreateUser, saveProfile, updateAvatar, getCampaignByQuestId, getCampaignParticipantByQuestId, getCampaignById } from "../services/dbService"
import { generateInitialQuests, getUserActiveQuests } from "../services/dailyWeeklyQuestService"
import { supabase } from "../lib/supabase"
import type { OnChainReward } from "../services/rewardsService.js"

export const questsRouter: Router = Router()

/**
 * GET /quests
 * Get all active quests (must be BEFORE /:id routes to avoid conflict)
 * Optional query param: ?participant=0x... to filter by assigned participant and include progress
 */
questsRouter.get("/", async (req, res, next) => {
  try {
    const participant = req.query.participant as string | undefined
    
    let query = supabase
      .from("quests")
      .select("*")
      .eq("status", "active")
    
    // Filter by participant if provided
    if (participant && /^0x[a-fA-F0-9]{40}$/.test(participant)) {
      query = query.eq("assigned_participant", participant.toLowerCase())
    }
    
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      throw new Error(`Failed to get quests: ${error.message}`)
    }

    // If participant is provided, fetch progress for each quest
    const questsWithProgress = data || []
    if (participant && /^0x[a-fA-F0-9]{40}$/.test(participant)) {
      const progressPromises = questsWithProgress.map(async (quest: any) => {
        try {
          const progress = await getParticipantProgress(
            Number(quest.quest_id_on_chain),
            participant
          )
          return {
            ...quest,
            progress: {
              accepted: progress.accepted || false,
              completed: progress.completed || false,
            },
          }
        } catch (err) {
          // If progress fetch fails, return quest without progress
          return {
            ...quest,
            progress: {
              accepted: false,
              completed: false,
            },
          }
        }
      })
      
      const quests = await Promise.all(progressPromises)
      return res.json({ quests })
    }

    return res.json({ quests: questsWithProgress })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/leaderboard
 * Get leaderboard (must be BEFORE /:id routes)
 */
questsRouter.get("/leaderboard", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 100
    const leaderboard = await getLeaderboard(limit)
    return res.json({
      leaderboard: leaderboard.map((entry) => ({
        user_id: entry.user_id,
        wallet_address: entry.wallet_address,
        total_xp: entry.total_xp,
        completed_quests: entry.completed_quests,
        level: entry.level,
        rank: entry.rank,
        updated_at: entry.updated_at,
        name: entry.name,
        email: entry.email,
        avatar_url: entry.avatar_url,
      })),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/users/:address/quests
 * Get user's daily and weekly quests (must be BEFORE /:id routes)
 */
questsRouter.get("/users/:address/quests", async (req, res, next) => {
  try {
    const address = req.params.address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    const quests = await getUserActiveQuests(address)

    return res.json({
      quests: {
        daily: quests.daily,
        weekly: quests.weekly,
        all: quests.all,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/users/:address/stats
 * Get user stats (must be BEFORE /:id routes)
 */
questsRouter.get("/users/:address/stats", async (req, res, next) => {
  try {
    const address = req.params.address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    // Get or create user first
    await getOrCreateUser(address)

    const stats = await getUserStats(address)
    if (!stats) {
      // User created but no stats yet, return defaults with proper format
      // Also get user profile data (name, email) if exists
      const { data: user } = await supabase
        .from("users")
        .select("name, email")
        .eq("wallet_address", address.toLowerCase())
        .single()
      
      // Calculate rank for new user (will be unranked if no XP)
      const { count } = await supabase
        .from("user_stats")
        .select("*", { count: "exact", head: true })
        .gt("total_xp", 0)

      // For new user with 0 XP, rank is null (unranked)
      // If they have XP but not in user_stats yet, they'll be last
      const rank = null

      return res.json({
        stats: {
          user_id: address, // Use wallet address as user_id for new users
          wallet_address: address,
          total_xp: 0,
          completed_quests: 0,
          level: 1,
          rank,
          updated_at: new Date().toISOString(),
          name: user?.name || undefined,
          email: user?.email || undefined,
        },
      })
    }

    return res.json({ stats })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /quests/users/:address/generate-quests
 * Generate initial daily and weekly quests for user (triggered after profile complete)
 */
questsRouter.post("/users/:address/generate-quests", async (req, res, next) => {
  try {
    const address = req.params.address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    // Check if user already has active daily/weekly quests
    const existingQuests = await getUserActiveQuests(address)
    const hasDaily = existingQuests.daily !== null
    const hasWeekly = existingQuests.weekly !== null

    // Only generate if user doesn't have active quests
    if (hasDaily && hasWeekly) {
      return res.json({
        success: true,
        message: "User already has active daily and weekly quests",
        quests: {
          daily: existingQuests.daily,
          weekly: existingQuests.weekly,
        },
      })
    }

    const results = await generateInitialQuests(address)

    return res.json({
      success: true,
      message: "Quests generated successfully",
      quests: {
        daily: results.daily || null,
        weekly: results.weekly || null,
      },
      errors: results.errors,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /quests/users/:address/profile
 * Save user profile (name, email)
 */
questsRouter.post("/users/:address/profile", async (req, res, next) => {
  try {
    const address = req.params.address
    const { name, email } = req.body

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" })
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" })
    }

    const user = await saveProfile(address, { name: name.trim(), email: email.trim() })

    // Get user with profile data (name, email, avatar_url) from DB
    const { data: userWithProfile } = await supabase
      .from("users")
      .select("id, wallet_address, name, email, avatar_url")
      .eq("wallet_address", address.toLowerCase())
      .single()

    // Generate initial daily and weekly quests after profile is saved
    // Don't wait for this - do it in background to avoid blocking response
    generateInitialQuests(address).catch((error) => {
      console.error("Failed to generate initial quests after profile save:", error)
      // Don't throw - quest generation failure shouldn't block profile save
    })

    return res.json({
      success: true,
      message: "Profile saved successfully. Daily and weekly quests are being generated...",
      user: {
        user_id: user.id,
        wallet_address: user.wallet_address,
        name: userWithProfile?.name || undefined,
        email: userWithProfile?.email || undefined,
        avatar_url: userWithProfile?.avatar_url || undefined,
      },
    })
  } catch (error: any) {
    if (error.message.includes("Invalid email") || error.message.includes("Name is required")) {
      return res.status(400).json({ message: error.message })
    }
    next(error)
  }
})

/**
 * PATCH /quests/users/:address/avatar
 * Update user avatar
 */
questsRouter.patch("/users/:address/avatar", async (req, res, next) => {
  try {
    const address = req.params.address
    const { avatar_url } = req.body

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    if (!avatar_url || typeof avatar_url !== "string" || avatar_url.trim().length === 0) {
      return res.status(400).json({ message: "Avatar URL is required" })
    }

    // Validate URL format (allow http/https/data URLs)
    try {
      if (!avatar_url.startsWith("http") && !avatar_url.startsWith("data:image")) {
        throw new Error("Invalid avatar URL format")
      }
    } catch {
      return res.status(400).json({ message: "Invalid avatar URL format" })
    }

    const user = await updateAvatar(address, avatar_url.trim())

    return res.json({
      success: true,
      message: "Avatar updated successfully",
      user: {
        user_id: user.id,
        wallet_address: user.wallet_address,
        avatar_url: user.avatar_url,
      },
    })
  } catch (error: any) {
    if (error.message.includes("Invalid avatar") || error.message.includes("Avatar URL")) {
      return res.status(400).json({ message: error.message })
    }
    next(error)
  }
})

/**
 * GET /quests/users/:address/rewards
 * Get user's rewards (VAEL + badges) from on-chain events
 */
questsRouter.get("/users/:address/rewards", async (req, res, next) => {
  try {
    const address = req.params.address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    // Import rewards service
    const { getUserRewardsFromChain } = await import("../services/rewardsService.js")

    // Get rewards from on-chain events (RewardReleased + BadgeMinted)
    const onChainRewards = await getUserRewardsFromChain(address)

    if (onChainRewards.length === 0) {
      return res.json({ rewards: [], totalVael: "0.00" })
    }

    // Get quest details from DB for context (title, etc)
    const questIds = onChainRewards.map((r: OnChainReward) => r.questId)
    const { data: quests } = await supabase
      .from("quests")
      .select("quest_id_on_chain, title, badge_level, quest_type")
      .in("quest_id_on_chain", questIds)

    // Calculate total VAEL earned
    // Note: reward.vaelAmount is already in VAEL (not wei) from database
    let totalVael = 0
    for (const reward of onChainRewards) {
      if (reward.vaelAmount && reward.vaelAmount !== "0") {
        const amount = parseFloat(reward.vaelAmount)
        if (!isNaN(amount) && amount > 0) {
          totalVael += amount
          console.log(`Adding reward: questId=${reward.questId}, amount=${reward.vaelAmount}, total=${totalVael}`)
        }
      }
    }
    const totalVaelFormatted = totalVael.toFixed(2)
    console.log(`Total VAEL calculated: ${totalVaelFormatted} from ${onChainRewards.length} rewards`)

    // Combine on-chain rewards with quest metadata
    // Note: reward.vaelAmount is already in VAEL (not wei) from database
    const rewards = onChainRewards.map((reward: OnChainReward) => {
      const quest = quests?.find((q) => q.quest_id_on_chain === reward.questId)
      const vaelAmount = reward.vaelAmount ? parseFloat(reward.vaelAmount).toFixed(2) : "0"

      return {
        tokenId: reward.badgeTokenId,
        questId: reward.questId,
        questTitle: quest?.title || `Quest #${reward.questId}`,
        badgeLevel: reward.badgeLevel || quest?.badge_level || 1,
        questType: quest?.quest_type || "custom",
        rewardAmount: vaelAmount, // Convert from wei to VAEL (18 decimals)
        badgeImageUri: reward.badgeImageUri, // IPFS image URL
        transactionHash: reward.transactionHash,
        earnedAt: reward.timestamp ? new Date(reward.timestamp * 1000).toISOString() : new Date().toISOString(),
      }
    })

    return res.json({
      rewards: rewards || [],
      totalVael: totalVaelFormatted, // Total VAEL earned across all quests
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/users/:address/completed
 * Get user's completed quests
 */
questsRouter.get("/users/:address/completed", async (req, res, next) => {
  try {
    const address = req.params.address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    // Get quest submissions that are verified for this user
    const { data: submissions, error: submissionsError } = await supabase
      .from("quest_submissions")
      .select("quest_id_on_chain, verification_status, completion_tx_hash")
      .eq("participant_address", address.toLowerCase())
      .eq("verification_status", "verified")

    if (submissionsError) {
      throw new Error(`Failed to get quest submissions: ${submissionsError.message}`)
    }

    if (!submissions || submissions.length === 0) {
      return res.json({ quests: [] })
    }

    // Get quest details for completed quests
    const questIds = submissions.map((s) => s.quest_id_on_chain)
    const { data: quests, error: questsError } = await supabase
      .from("quests")
      .select("*")
      .in("quest_id_on_chain", questIds)

    if (questsError) {
      throw new Error(`Failed to get quests: ${questsError.message}`)
    }

    // Match submissions with quests and add completion info
    const completedQuests = (quests || []).map((quest) => {
      const submission = submissions.find((s) => s.quest_id_on_chain === quest.quest_id_on_chain)
      return {
        ...quest,
        completionTxHash: submission?.completion_tx_hash,
        completedAt: submission?.completion_tx_hash ? new Date().toISOString() : undefined, // TODO: Get actual completion time
      }
    })

    return res.json({ quests: completedQuests || [] })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/:id/progress/:participant
 * Get participant progress for a quest (must be BEFORE /:id route)
 */
questsRouter.get("/:id/progress/:participant", async (req, res, next) => {
  try {
    const questId = Number(req.params.id)
    const participant = req.params.participant

    if (Number.isNaN(questId) || questId <= 0) {
      return res.status(400).json({ message: "Invalid quest id" })
    }
    if (!participant || !/^0x[a-fA-F0-9]{40}$/.test(participant)) {
      return res.status(400).json({ message: "Invalid participant address" })
    }

    const progress = await getParticipantProgress(questId, participant)
    return res.json({ questId, participant, progress })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/:id
 * Get quest by ID (must be LAST, after all specific routes)
 */
questsRouter.get("/:id", async (req, res, next) => {
  try {
    const questId = Number(req.params.id)
    if (Number.isNaN(questId) || questId <= 0) {
      return res.status(400).json({ message: "Invalid quest id" })
    }
    const quest = await getQuestById(questId)
    let campaign = await getCampaignByQuestId(questId)
    if (!campaign) {
      const cp = await getCampaignParticipantByQuestId(questId)
      if (cp) campaign = await getCampaignById(cp.campaign_id)
    }
    const payload: Record<string, unknown> = { ...quest }
    const thumb = campaign?.thumbnail
    if (thumb && typeof thumb === "string" && thumb.trim().length > 0) {
      payload.campaignThumbnail = thumb.trim()
    }
    return res.json({ quest: payload })
  } catch (error) {
    next(error)
  }
})

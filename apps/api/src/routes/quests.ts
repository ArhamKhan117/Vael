import { Router } from "express"
import { formatUnits } from "ethers"

import { getParticipantProgress } from "../services/questService"
import { getOrCreateUser, saveProfile, updateAvatar } from "../services/profileService"
import { generatePersonalQuest } from "../services/personalQuest"
import { createWorkerStore } from "../attestcoin/store"

/**
 * A player's own view of the quest board.
 *
 * Every quest, reward, and badge here is read from the index, which is filled from Creditcoin's
 * own events. The only thing this router reads out of a hand-written table is the player's name
 * and avatar, which is the only thing the chain does not hold.
 */
export const questsRouter: Router = Router()

const addressRegex = /^0x[a-fA-F0-9]{40}$/

/**
 * GET /quests/users/:address/quests
 *
 * The player's daily quest, weekly quest, and everything else assigned to them.
 */
questsRouter.get("/users/:address/quests", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    if (!addressRegex.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    const store = createWorkerStore()
    await store.init()
    const all = await store.questCatalog({ participant: address })

    // Newest first, so "the player's daily quest" means the current one and not the first one
    // they were ever given.
    const newestOf = (cadence: string) =>
      all.find((quest) => quest.cadence === cadence && quest.status === 1) ??
      all.find((quest) => quest.cadence === cadence) ??
      null

    return res.json({
      quests: { daily: newestOf("daily"), weekly: newestOf("weekly"), all },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/users/:address/stats
 *
 * XP and level come from the hero the chain minted; completed quests from the index. The name and
 * the avatar come from the profile table. Rank is the hero's position by level and XP.
 */
questsRouter.get("/users/:address/stats", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    if (!addressRegex.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    const user = await getOrCreateUser(address)
    const store = createWorkerStore()
    await store.init()

    const [heroes, quests] = await Promise.all([
      store.allHeroes(),
      store.questCatalog({ participant: address }),
    ])

    const ranked = heroes
      .map((hero) => ({ hero, value: hero.level * 1_000_000 + Number(hero.xp) }))
      .sort((a, b) => b.value - a.value)
    const position = ranked.findIndex(
      (entry) => entry.hero.player.toLowerCase() === address.toLowerCase()
    )
    const mine = position >= 0 ? ranked[position]?.hero : undefined

    return res.json({
      stats: {
        user_id: user.id ?? address,
        wallet_address: address,
        total_xp: Number(mine?.xp ?? 0),
        completed_quests: quests.filter((quest) => quest.completed).length,
        level: mine?.level ?? 1,
        // Unranked rather than last: a player with no hero has not been measured yet.
        rank: position >= 0 ? position + 1 : null,
        updated_at: mine?.updatedAt ?? new Date().toISOString(),
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /quests/users/:address/generate-quests
 *
 * Ask the quest agent for a daily and a weekly quest, both created on chain with the verification
 * rule that governs them. It never invents a quest in the database: a quest that QuestASC does not
 * know about cannot be completed, and one that cannot be completed should not be shown.
 */
questsRouter.post("/users/:address/generate-quests", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    if (!addressRegex.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    const store = createWorkerStore()
    await store.init()
    const existing = await store.questCatalog({ participant: address })
    const hasOpen = (cadence: string) =>
      existing.some((quest) => quest.cadence === cadence && quest.status === 1 && !quest.completed)

    const results: { daily?: { questId: number }; weekly?: { questId: number } } = {}
    const errors: { daily?: string; weekly?: string } = {}

    for (const cadence of ["daily", "weekly"] as const) {
      if (hasOpen(cadence)) continue
      try {
        const generated = await generatePersonalQuest(address, cadence)
        results[cadence] = { questId: generated.questId }
      } catch (error) {
        errors[cadence] = error instanceof Error ? error.message : String(error)
      }
    }

    const message =
      Object.keys(results).length > 0
        ? "Quests created on chain. They appear once the indexer has seen them."
        : Object.keys(errors).length > 0
          ? "No quest could be created."
          : "This player already has an open daily and weekly quest."

    return res.json({
      success: Object.keys(errors).length === 0,
      message,
      quests: results,
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /quests/users/:address/profile
 */
questsRouter.post("/users/:address/profile", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    const { name, email } = req.body ?? {}

    if (!addressRegex.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" })
    }
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" })
    }

    const user = await saveProfile(address, { name: name.trim(), email: email.trim() })

    // Quest generation is a chain transaction and a model call, so it does not block the save.
    generatePersonalQuest(address, "daily").catch((error) => {
      console.error("[profile] daily quest generation failed:", error?.message ?? error)
    })

    return res.json({
      success: true,
      message: "Profile saved. Your first quest is being created on chain.",
      user: {
        user_id: user.id,
        wallet_address: user.wallet_address,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
    })
  } catch (error: any) {
    if (
      String(error?.message).includes("Invalid email") ||
      String(error?.message).includes("Name is required")
    ) {
      return res.status(400).json({ message: error.message })
    }
    next(error)
  }
})

/**
 * PATCH /quests/users/:address/avatar
 */
questsRouter.patch("/users/:address/avatar", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    const avatarUrl = req.body?.avatar_url

    if (!addressRegex.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }
    if (!avatarUrl || typeof avatarUrl !== "string" || avatarUrl.trim().length === 0) {
      return res.status(400).json({ message: "Avatar URL is required" })
    }
    if (!avatarUrl.startsWith("http") && !avatarUrl.startsWith("data:image")) {
      return res.status(400).json({ message: "Invalid avatar URL format" })
    }

    const user = await updateAvatar(address, avatarUrl.trim())
    return res.json({
      success: true,
      message: "Avatar updated",
      user: {
        user_id: user.id,
        wallet_address: user.wallet_address,
        avatar_url: user.avatar_url,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/users/:address/rewards
 *
 * Every VAEL payout and every badge, from the two events that produced them. A reward exists here
 * because RewardVault or CampaignEscrow emitted it, and a badge because BadgeNFT did.
 */
questsRouter.get("/users/:address/rewards", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    if (!addressRegex.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    const store = createWorkerStore()
    await store.init()
    const [rewards, badges, quests] = await Promise.all([
      store.allRewards(),
      store.badges(address),
      store.questCatalog(),
    ])

    const mine = rewards.filter(
      (reward) => reward.recipient.toLowerCase() === address.toLowerCase()
    )

    /**
     * Find the quest a historical row actually refers to, or none.
     *
     * Quest ids are only comparable inside one QuestManager. RewardVault, CampaignEscrow and
     * BadgeNFT all survive a redeploy, so their events keep referring to quest ids that a new
     * QuestManager has since reissued from 1. Matching on the id alone would put the title of a
     * brand new quest on a reward earned months ago, on a quest that no longer exists.
     *
     * A reward or a badge can never precede the quest that produced it, so a candidate whose
     * creation block is above the row's block belongs to a later generation and is not a match.
     */
    const questFor = (questId: number, atBlock: number) => {
      const candidate = quests.find((quest) => quest.questId === questId)
      if (!candidate) return undefined
      const created = candidate.creditcoinBlock ?? 0
      return created > atBlock ? undefined : candidate
    }
    const titleOf = (questId: number, atBlock: number) =>
      questFor(questId, atBlock)?.title || `Quest #${questId}`

    let total = 0n
    for (const reward of mine) total += BigInt(reward.amount)

    return res.json({
      rewards: mine.map((reward) => {
        // Same rule for the badge: BadgeNFT survives a redeploy, so a badge minted for the old
        // quest 3 must not be attached to a reward for the new one.
        const badge = badges.find(
          (entry) => entry.questId === reward.questId && entry.creditcoinBlock <= reward.creditcoinBlock
        )
        return {
          questId: reward.questId,
          questTitle: titleOf(reward.questId, reward.creditcoinBlock),
          rewardAmount: formatUnits(reward.amount, 18),
          transactionHash: reward.creditcoinTxHash,
          creditcoinBlock: reward.creditcoinBlock,
          earnedAt: reward.createdAt,
          ...(badge
            ? {
                tokenId: badge.tokenId,
                badgeLevel: badge.badgeLevel,
                rarity: badge.rarity,
                rarityIsDerived: badge.rarityIsDerived,
              }
            : {}),
        }
      }),
      totalVael: formatUnits(total, 18),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/users/:address/completed
 */
questsRouter.get("/users/:address/completed", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    if (!addressRegex.test(address)) {
      return res.status(400).json({ message: "Invalid wallet address" })
    }

    const store = createWorkerStore()
    await store.init()
    const [quests, actions] = await Promise.all([
      store.questCatalog({ participant: address }),
      store.actions(address),
    ])

    return res.json({
      quests: quests
        .filter((quest) => quest.completed)
        .map((quest) => {
          const proof = actions.find((action) => action.questId === quest.questId)
          return {
            questId: quest.questId,
            title: quest.title || `Quest #${quest.questId}`,
            description: quest.description ?? "",
            cadence: quest.cadence ?? "open",
            rewardVael: formatUnits(quest.rewardAmount ?? "0", 18),
            badgeLevel: quest.badgeLevel ?? 1,
            ...(proof
              ? {
                  replayKey: proof.replayKey,
                  sourceBlock: proof.sourceBlock,
                  creditcoinBlock: proof.creditcoinBlock,
                  completedAt: proof.createdAt,
                }
              : {}),
          }
        }),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/:id/progress/:participant
 *
 * Read straight off QuestManager. Acceptance and completion are never answered from a cache.
 */
questsRouter.get("/:id/progress/:participant", async (req, res, next) => {
  try {
    const questId = Number(req.params.id)
    const participant = String(req.params.participant)

    if (!Number.isInteger(questId) || questId <= 0) {
      return res.status(400).json({ message: "Invalid quest id" })
    }
    if (!addressRegex.test(participant)) {
      return res.status(400).json({ message: "Invalid participant address" })
    }

    const progress = await getParticipantProgress(questId, participant)
    return res.json({ questId, participant, progress })
  } catch (error) {
    next(error)
  }
})

import { Router } from "express"
import { Contract } from "ethers"

import { creditcoinProvider } from "../attestcoin/config"
import { createWorkerStore } from "../attestcoin/store"
import { RAID_BOSS_READ_ABI, VAEL_HERO_READ_ABI } from "../indexer/abi"

export const gameRouter: Router = Router()

function contractAddress(name: string): string | undefined {
  const value = process.env[name]
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? value : undefined
}

/**
 * GET /hero/:address
 *
 * Reads the hero from the contract, not the index, because a single hero is one cheap call and the
 * contract cannot be stale. The index is for lists, where per-row calls would not scale.
 */
gameRouter.get("/hero/:address", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "address must be a 20-byte hex address" })
    }
    const heroAddress = contractAddress("VAEL_HERO_ADDRESS")
    if (!heroAddress) return res.status(503).json({ message: "VaelHero is not configured" })

    const hero = new Contract(heroAddress, VAEL_HERO_READ_ABI, creditcoinProvider())
    const tokenId: bigint = await hero.getFunction("heroOf").staticCall(address)
    if (tokenId === 0n) {
      return res.json({ address, hasHero: false })
    }

    const h = await hero.getFunction("heroByAddress").staticCall(address)
    const strength = Number(h[2])
    const agility = Number(h[3])
    const intellect = Number(h[4])

    return res.json({
      address,
      hasHero: true,
      tokenId: Number(tokenId),
      level: Number(h[0]),
      xp: h[1].toString(),
      strength,
      agility,
      intellect,
      // The dominant affinity picks the hero's sprite in the game client.
      affinity: dominantAffinity(strength, agility, intellect),
      lastActionSourceBlock: Number(h[6]),
      streak: Number(h[7]),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * Which of the three a hero leans towards, or "novice" when it has yet to lean anywhere.
 *
 * Every stat point comes from a verified proof, so a hero with none has done nothing yet. Calling
 * that a warrior put an armoured knight on screen for a player who had not made a single
 * transaction, which is a claim the chain does not support.
 */
function dominantAffinity(strength: number, agility: number, intellect: number): string {
  if (strength === 0 && agility === 0 && intellect === 0) return "novice"
  if (strength >= agility && strength >= intellect) return "warrior"
  if (agility >= intellect) return "rogue"
  return "mage"
}

/**
 * GET /raid/current
 *
 * Live HP and loot come from the contract; the damage feed and per-player totals come from the
 * index, because they are a list.
 */
gameRouter.get("/raid/current", async (_req, res, next) => {
  try {
    const raidAddress = contractAddress("RAID_BOSS_ADDRESS")
    if (!raidAddress) return res.status(503).json({ message: "RaidBoss is not configured" })

    const raid = new Contract(raidAddress, RAID_BOSS_READ_ABI, creditcoinProvider())
    const seasonId: bigint = await raid.getFunction("currentSeasonId").staticCall()
    if (seasonId === 0n) {
      return res.json({ seasonId: 0, active: false, message: "No season has started yet." })
    }

    const s = await raid.getFunction("currentSeason").staticCall()
    const store = createWorkerStore()
    await store.init()
    const hits = await store.raidHits(Number(seasonId))

    const byPlayer = new Map<string, bigint>()
    for (const hit of hits) {
      byPlayer.set(hit.player, (byPlayer.get(hit.player) ?? 0n) + BigInt(hit.damage))
    }
    const topDamage = [...byPlayer.entries()]
      .map(([player, damage]) => ({ player, damage: damage.toString() }))
      .sort((a, b) => (BigInt(b.damage) > BigInt(a.damage) ? 1 : -1))
      .slice(0, 20)

    return res.json({
      seasonId: Number(seasonId),
      active: !s[5],
      maxHp: s[0].toString(),
      hp: s[1].toString(),
      lootPool: s[3].toString(),
      lastHitter: s[4],
      defeated: s[5],
      totalDamage: s[6].toString(),
      topDamage,
      recentHits: hits.slice(0, 25).map((hit) => ({
        player: hit.player,
        damage: hit.damage,
        hpRemaining: hit.hpRemaining,
        actionType: hit.actionType,
        replayKey: hit.replayKey,
        at: hit.createdAt,
      })),
    })
  } catch (error) {
    next(error)
  }
})

/** What a player would receive if they claimed the current season now. */
gameRouter.get("/raid/:seasonId/pending/:address", async (req, res, next) => {
  try {
    const seasonId = Number(req.params.seasonId)
    const address = String(req.params.address)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "address must be a 20-byte hex address" })
    }
    const raidAddress = contractAddress("RAID_BOSS_ADDRESS")
    if (!raidAddress) return res.status(503).json({ message: "RaidBoss is not configured" })

    const raid = new Contract(raidAddress, RAID_BOSS_READ_ABI, creditcoinProvider())
    const [damage, pending] = await Promise.all([
      raid.getFunction("damageOf").staticCall(seasonId, address),
      raid.getFunction("pendingLoot").staticCall(seasonId, address),
    ])
    return res.json({
      seasonId,
      address,
      damage: damage.toString(),
      pendingLoot: pending.toString(),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /leaderboard
 *
 * Two rankings from the index: hero XP and raid damage. Every entry traces to verified proofs,
 * which is what makes the ranking worth having.
 */
gameRouter.get("/leaderboard", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    const store = createWorkerStore()
    await store.init()

    const heroes = await store.allHeroes()
    const byXp = heroes
      .map((hero) => ({
        address: hero.player,
        level: hero.level,
        xp: hero.xp,
        // Level and remaining XP together, so a level 3 hero outranks a level 2 with more spare XP.
        rankValue: hero.level * 1_000_000 + Number(hero.xp),
        strength: hero.strength,
        agility: hero.agility,
        intellect: hero.intellect,
      }))
      .sort((a, b) => b.rankValue - a.rankValue)
      .slice(0, limit)

    const raidAddress = contractAddress("RAID_BOSS_ADDRESS")
    let byDamage: { address: string; damage: string }[] = []
    let seasonId = 0
    if (raidAddress) {
      const raid = new Contract(raidAddress, RAID_BOSS_READ_ABI, creditcoinProvider())
      seasonId = Number(await raid.getFunction("currentSeasonId").staticCall())
      if (seasonId > 0) {
        const hits = await store.raidHits(seasonId)
        const totals = new Map<string, bigint>()
        for (const hit of hits) {
          totals.set(hit.player, (totals.get(hit.player) ?? 0n) + BigInt(hit.damage))
        }
        byDamage = [...totals.entries()]
          .map(([address, damage]) => ({ address, damage: damage.toString() }))
          .sort((a, b) => (BigInt(b.damage) > BigInt(a.damage) ? 1 : -1))
          .slice(0, limit)
      }
    }

    return res.json({ byXp, raid: { seasonId, byDamage } })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /stats
 *
 * The five numbers the landing page and the leaderboard show. Every one of them is a sum over rows
 * the indexer wrote from Creditcoin's own events, or a read of the boss contract itself. There is
 * no seeded, projected, or illustrative figure anywhere in this response: if nothing has happened
 * yet the numbers are zero, and zero is the honest answer.
 */
gameRouter.get("/stats", async (_req, res, next) => {
  try {
    const store = createWorkerStore()
    await store.init()

    const [heroes, actions, rewards] = await Promise.all([
      store.allHeroes(),
      store.actions(),
      store.allRewards(),
    ])

    const totalXp = heroes.reduce((sum, hero) => sum + BigInt(hero.xp), 0n)
    const vaelReleased = rewards.reduce((sum, reward) => sum + BigInt(reward.amount), 0n)

    // Raid damage comes from the boss itself rather than a sum of indexed hits, because the
    // contract keeps the running total and cannot be behind.
    let season: { seasonId: number; active: boolean; totalDamage: string } = {
      seasonId: 0,
      active: false,
      totalDamage: "0",
    }
    const raidAddress = contractAddress("RAID_BOSS_ADDRESS")
    if (raidAddress) {
      const raid = new Contract(raidAddress, RAID_BOSS_READ_ABI, creditcoinProvider())
      const seasonId: bigint = await raid.getFunction("currentSeasonId").staticCall()
      if (seasonId > 0n) {
        const s = await raid.getFunction("currentSeason").staticCall()
        season = {
          seasonId: Number(seasonId),
          active: !s[5],
          totalDamage: s[6].toString(),
        }
      }
    }

    return res.json({
      heroesMinted: heroes.length,
      totalHeroXp: totalXp.toString(),
      proofsVerified: actions.length,
      vaelReleased: vaelReleased.toString(),
      season,
      indexedThrough: (await store.getCursor(102031, "creditcoin-index"))?.lastBlock ?? 0,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /actions/:address
 *
 * Every action this address proved, newest first. This is the history the profile page shows.
 */
gameRouter.get("/actions/:address", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "address must be a 20-byte hex address" })
    }
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    const store = createWorkerStore()
    await store.init()

    const [actions, rewards] = await Promise.all([store.actions(address), store.allRewards()])
    const mine = rewards.filter((reward) => reward.recipient.toLowerCase() === address.toLowerCase())

    // Quest ids are only comparable inside one QuestManager. RewardVault and CampaignEscrow
    // survive a redeploy, so their events keep naming quest ids a new QuestManager has since
    // reissued from 1: nine releases in the index were paid for quests 1 to 11 of a superseded
    // manager. A release can never precede the action it paid for, and never follow it by more
    // than the worker takes to submit, so the release this action earned is the first one for its
    // quest id at or after the action's own block. Keyed on the id alone, an old release could be
    // shown against a new quest that happened to reuse its number.
    const releaseFor = (action: { questId: number; creditcoinBlock: number }) =>
      mine
        .filter((reward) => reward.questId === action.questId && reward.creditcoinBlock >= action.creditcoinBlock)
        .sort((a, b) => a.creditcoinBlock - b.creditcoinBlock)[0]

    return res.json({
      address: address.toLowerCase(),
      // `actionType` stays a number: the web app already mirrors VaelTypes.ActionType and owns
      // the labels, and a second copy of that map here would only drift from it.
      actions: actions.slice(0, limit).map((action) => ({
        ...action,
        vaelReleased: releaseFor(action)?.amount ?? "0",
      })),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /badges/:address
 *
 * BadgeNFT is not enumerable, so this comes from the index rather than the contract. Each badge
 * carries `rarityIsDerived`, which says whether the chain stated the rarity or whether it was
 * computed from the badge level by the published rule. The deployed v2 does not store one.
 */
gameRouter.get("/badges/:address", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ message: "address must be a 20-byte hex address" })
    }
    const store = createWorkerStore()
    await store.init()
    const badges = await store.badges(address)
    return res.json({ address: address.toLowerCase(), badges })
  } catch (error) {
    next(error)
  }
})

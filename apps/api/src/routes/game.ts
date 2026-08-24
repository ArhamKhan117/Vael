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

function dominantAffinity(strength: number, agility: number, intellect: number): string {
  if (strength === 0 && agility === 0 && intellect === 0) return "warrior"
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

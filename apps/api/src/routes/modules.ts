import { Router } from "express"
import { Contract } from "ethers"

import { creditcoinProvider } from "../attestcoin/config"
import { createWorkerStore } from "../attestcoin/store"
import { EQUIPMENT_READ_ABI, LOOT_READ_ABI, VAEL_HERO_READ_ABI } from "../indexer/abi"

export const modulesRouter: Router = Router()

/** Slot and rarity names, mirroring Loot's own constants. */
const SLOTS = ["weapon", "armour", "trinket", "relic"]
const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"]

function contractAddress(name: string): string | undefined {
  const value = process.env[name]
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? value : undefined
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)
}

interface ItemKind {
  itemId: number
  name: string
  slot: number
  slotName: string
  rarity: number
  rarityName: string
  strength: number
  agility: number
  intellect: number
  uri: string
}

/**
 * The item catalogue, read from Loot and cached.
 *
 * Items are immutable once registered and new ones only ever append, so the cache is invalidated by
 * `nextItemId` moving rather than by a timer. Reading it from the chain instead of importing the
 * web app's catalogue file keeps one source of truth: what the contract actually holds.
 */
let cache: { nextItemId: number; items: ItemKind[] } | undefined

async function catalogue(): Promise<ItemKind[]> {
  const lootAddress = contractAddress("LOOT_ADDRESS")
  if (!lootAddress) return []

  const loot = new Contract(lootAddress, LOOT_READ_ABI, creditcoinProvider())
  const nextItemId = Number(await loot.getFunction("nextItemId").staticCall())
  if (cache && cache.nextItemId === nextItemId) return cache.items

  const items: ItemKind[] = []
  for (let itemId = 1; itemId < nextItemId; itemId++) {
    const [item, uri] = await Promise.all([
      loot.getFunction("itemOf").staticCall(itemId),
      loot.getFunction("uri").staticCall(itemId),
    ])
    if (!item[6]) continue
    items.push({
      itemId,
      name: item[0],
      slot: Number(item[1]),
      slotName: SLOTS[Number(item[1])] ?? String(item[1]),
      rarity: Number(item[2]),
      rarityName: RARITIES[Number(item[2])] ?? String(item[2]),
      strength: Number(item[3]),
      agility: Number(item[4]),
      intellect: Number(item[5]),
      uri,
    })
  }

  cache = { nextItemId, items }
  return items
}

/** GET /items - every registered item kind. */
modulesRouter.get("/items", async (_req, res, next) => {
  try {
    return res.json({ items: await catalogue() })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /arena/challenges?address=&status=
 *
 * Defaults to the open board. Pass an address to see only duels that address is part of.
 */
modulesRouter.get("/arena/challenges", async (req, res, next) => {
  try {
    const address = typeof req.query.address === "string" ? req.query.address : undefined
    if (address && !isAddress(address)) {
      return res.status(400).json({ message: "address must be a 20-byte hex address" })
    }
    const status = typeof req.query.status === "string" ? req.query.status : "open"

    const store = createWorkerStore()
    await store.init()
    const filter: { address?: string; status?: string } = {}
    if (address) filter.address = address
    if (status !== "all") filter.status = status

    return res.json({ challenges: await store.challenges(filter) })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /arena/history?address=&limit=
 *
 * Finished duels, newest first, each with the round log a client replays. The log is the chain's
 * own account of the fight: three bytes per swing, so a replay cannot show something that did not
 * happen.
 */
modulesRouter.get("/arena/history", async (req, res, next) => {
  try {
    const address = typeof req.query.address === "string" ? req.query.address : undefined
    if (address && !isAddress(address)) {
      return res.status(400).json({ message: "address must be a 20-byte hex address" })
    }
    const limit = Math.min(Number(req.query.limit ?? 25), 200)

    const store = createWorkerStore()
    await store.init()
    const all = await store.challenges(address ? { address } : undefined)
    const finished = all.filter((c) => c.status === "resolved" || c.status === "drawn")

    return res.json({ challenges: finished.slice(0, limit) })
  } catch (error) {
    next(error)
  }
})

/** GET /arena/challenge/:id */
modulesRouter.get("/arena/challenge/:id", async (req, res, next) => {
  try {
    const challengeId = Number(req.params.id)
    if (!Number.isInteger(challengeId) || challengeId <= 0) {
      return res.status(400).json({ message: "challenge id must be a positive integer" })
    }
    const store = createWorkerStore()
    await store.init()
    const challenge = await store.getChallenge(challengeId)
    if (!challenge) return res.status(404).json({ message: "no such challenge" })
    return res.json(challenge)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /inventory/:address
 *
 * Balances and the equipped loadout, read live from the contracts rather than from the index.
 * An ERC-1155 balance changes through transfers this indexer does not watch, so a reconstructed
 * inventory would drift the first time somebody moved an item outside the marketplace.
 */
modulesRouter.get("/inventory/:address", async (req, res, next) => {
  try {
    const address = String(req.params.address)
    if (!isAddress(address)) {
      return res.status(400).json({ message: "address must be a 20-byte hex address" })
    }

    const lootAddress = contractAddress("LOOT_ADDRESS")
    if (!lootAddress) return res.status(503).json({ message: "Loot is not configured" })

    const items = await catalogue()
    const provider = creditcoinProvider()
    const loot = new Contract(lootAddress, LOOT_READ_ABI, provider)

    const ids = items.map((item) => item.itemId)
    const owners = ids.map(() => address)
    const balances: bigint[] = ids.length
      ? await loot.getFunction("balanceOfBatch").staticCall(owners, ids)
      : []

    const held = items
      .map((item, index) => ({ ...item, amount: Number(balances[index] ?? 0n) }))
      .filter((item) => item.amount > 0)

    // The loadout is keyed by hero token id, so an address with no hero simply has none.
    let heroTokenId = 0
    let equipped: { slot: number; slotName: string; itemId: number }[] = []
    let bonuses = { strength: 0, agility: 0, intellect: 0 }

    const heroAddress = contractAddress("VAEL_HERO_ADDRESS")
    const equipmentAddress = contractAddress("EQUIPMENT_ADDRESS")
    if (heroAddress && equipmentAddress) {
      const hero = new Contract(heroAddress, VAEL_HERO_READ_ABI, provider)
      heroTokenId = Number(await hero.getFunction("heroOf").staticCall(address))
      if (heroTokenId > 0) {
        const equipment = new Contract(equipmentAddress, EQUIPMENT_READ_ABI, provider)
        const [slots, totals] = await Promise.all([
          equipment.getFunction("loadout").staticCall(heroTokenId),
          equipment.getFunction("bonusesOf").staticCall(heroTokenId),
        ])
        equipped = (slots as bigint[]).map((itemId, slot) => ({
          slot,
          slotName: SLOTS[slot] ?? String(slot),
          itemId: Number(itemId),
        }))
        bonuses = {
          strength: Number(totals[0]),
          agility: Number(totals[1]),
          intellect: Number(totals[2]),
        }
      }
    }

    const store = createWorkerStore()
    await store.init()

    return res.json({
      address: address.toLowerCase(),
      heroTokenId,
      items: held,
      equipped,
      bonuses,
      drops: (await store.drops(address)).slice(0, 50),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /market/listings?status=&seller=
 *
 * Defaults to what is currently for sale. Items are escrowed on listing, so every active row here
 * is fillable rather than a promise the seller may already have broken.
 */
modulesRouter.get("/market/listings", async (req, res, next) => {
  try {
    const seller = typeof req.query.seller === "string" ? req.query.seller : undefined
    if (seller && !isAddress(seller)) {
      return res.status(400).json({ message: "seller must be a 20-byte hex address" })
    }
    const status = typeof req.query.status === "string" ? req.query.status : "active"

    const store = createWorkerStore()
    await store.init()
    const filter: { status?: string; seller?: string } = {}
    if (status !== "all") filter.status = status
    if (seller) filter.seller = seller

    const listings = await store.listings(filter)
    const items = await catalogue()
    const byId = new Map(items.map((item) => [item.itemId, item]))

    return res.json({
      listings: listings.map((listing) => ({ ...listing, item: byId.get(listing.itemId) ?? null })),
    })
  } catch (error) {
    next(error)
  }
})

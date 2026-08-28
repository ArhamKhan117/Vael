import { Contract, Interface, JsonRpcProvider, Log } from "ethers"

import { env } from "../config/env"
import { creditcoinProvider } from "../attestcoin/config"
import {
  IndexedChallenge,
  IndexedListing,
  WorkerStore,
  createWorkerStore,
} from "../attestcoin/store"
import {
  INDEXER_ABI,
  QUEST_ASC_READ_ABI,
  QUEST_MANAGER_READ_ABI,
  VAEL_HERO_READ_ABI,
} from "./abi"

/**
 * Reads Creditcoin's own events into the store.
 *
 * The index exists for two reasons. The worker needs it to answer "which quest does this Sepolia
 * log belong to?" for a third-party protocol whose event knows nothing about Vael; before this,
 * the operator had to say so by hand through an environment variable. The game needs it because a
 * leaderboard cannot be assembled from per-request contract calls.
 *
 * Nothing here is authoritative. Every row is derived from an event the chain emitted, so a
 * corrupted or deleted index is rebuilt by rescanning, and no decision depends on it that the
 * chain would not make the same way.
 */

/** Creditcoin's RPC times out `eth_getLogs` after 10 seconds, so every scan is chunked. */
const CURSOR_KEY = "creditcoin-index"
const CREDITCOIN_CHAIN_KEY = 102031
const CONFIRMATIONS = 1

export interface IndexOutcome {
  fromBlock: number
  toBlock: number
  logsSeen: number
  questsTouched: number
  heroesTouched: number
  raidHits: number
  actions: number
  rewards: number
  badges: number
  arena: number
  drops: number
  equipment: number
  listings: number
}

/** Decode a short ASCII tag packed into a bytes32, such as "raid" or "arena". */
export function decodeTag(hex: string): string {
  const bytes = hex.replace(/^0x/, "").replace(/(00)+$/, "")
  let out = ""
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = parseInt(bytes.slice(i, i + 2), 16)
    if (code >= 32 && code < 127) out += String.fromCharCode(code)
  }
  return out
}

/** Mirrors BadgeNFT.rarityForBadgeLevel: 1 is Common through 5 and above, Legendary. */
export function rarityForBadgeLevel(badgeLevel: number): number {
  if (badgeLevel >= 5) return 4
  return Math.max(0, badgeLevel - 1)
}

export class CreditcoinIndexer {
  private readonly provider: JsonRpcProvider
  private readonly store: WorkerStore
  private readonly iface = new Interface([...INDEXER_ABI])
  private readonly addresses: string[]

  constructor(store?: WorkerStore, provider?: JsonRpcProvider) {
    this.provider = provider ?? creditcoinProvider()
    this.store = store ?? createWorkerStore()
    this.addresses = [
      env.QUEST_MANAGER_ADDRESS,
      process.env.QUEST_ASC_ADDRESS,
      process.env.VAEL_HERO_ADDRESS,
      process.env.RAID_BOSS_ADDRESS,
      process.env.REWARD_VAULT_ADDRESS,
      process.env.BADGE_NFT_ADDRESS,
      process.env.ARENA_ADDRESS,
      process.env.LOOT_ADDRESS,
      process.env.EQUIPMENT_ADDRESS,
      process.env.MARKETPLACE_ADDRESS,
    ].filter((a): a is string => !!a && /^0x[0-9a-fA-F]{40}$/.test(a))
  }

  async init(): Promise<void> {
    await this.store.init()
    await this.warnOnMisconfiguredAddresses()
  }

  /**
   * Compare the configured addresses against what the chain says they should be.
   *
   * A stale address here does not fail: the indexer simply watches a contract that emits nothing,
   * and the only symptom is a number that stays at zero forever. That happened with a superseded
   * RewardVault, and nothing anywhere reported it. Warning is enough; the deployment is the
   * authority and refusing to start would be worse than running with a gap.
   */
  private async warnOnMisconfiguredAddresses(): Promise<void> {
    const ascAddress = process.env.QUEST_ASC_ADDRESS
    if (!ascAddress) return

    const complain = (name: string, configured: string | undefined, onChain: string) => {
      if (!configured || configured.toLowerCase() !== onChain.toLowerCase()) {
        console.warn(
          `[indexer] ${name} is configured as ${configured ?? "unset"} but the live deployment ` +
            `uses ${onChain}. Events from it will be missed until the environment is corrected.`
        )
      }
    }

    try {
      const asc = new Contract(ascAddress, QUEST_ASC_READ_ABI, this.provider)
      const managerOnChain: string = await asc.getFunction("QUEST_MANAGER").staticCall()
      complain("QUEST_MANAGER_ADDRESS", env.QUEST_MANAGER_ADDRESS, managerOnChain)

      const manager = new Contract(managerOnChain, QUEST_MANAGER_READ_ABI, this.provider)
      const [badge, vault] = await Promise.all([
        manager.getFunction("BADGE_NFT").staticCall(),
        manager.getFunction("REWARD_VAULT").staticCall(),
      ])
      complain("BADGE_NFT_ADDRESS", process.env.BADGE_NFT_ADDRESS, badge)
      complain("REWARD_VAULT_ADDRESS", process.env.REWARD_VAULT_ADDRESS, vault)
    } catch (error) {
      // A check that cannot run must never stop the indexer from indexing.
      console.warn(`[indexer] could not check configured addresses against the chain: ${error}`)
    }
  }

  /** Scan from the persisted cursor to the safe head, in adaptive chunks. */
  async scanOnce(): Promise<IndexOutcome> {
    const head = (await this.provider.getBlockNumber()) - CONFIRMATIONS
    const cursor = await this.store.getCursor(CREDITCOIN_CHAIN_KEY, CURSOR_KEY)
    const from = cursor ? cursor.lastBlock + 1 : Math.max(0, head - env.WORKER_LOG_CHUNK_MAX)

    const outcome: IndexOutcome = {
      fromBlock: from,
      toBlock: from - 1,
      logsSeen: 0,
      questsTouched: 0,
      heroesTouched: 0,
      raidHits: 0,
      actions: 0,
      rewards: 0,
      badges: 0,
      arena: 0,
      drops: 0,
      equipment: 0,
      listings: 0,
    }
    if (from > head || this.addresses.length === 0) return outcome

    let window = env.WORKER_LOG_CHUNK_MAX
    let cursorAt = from
    while (cursorAt <= head) {
      const to = Math.min(cursorAt + window - 1, head)
      let logs: Log[]
      try {
        logs = await this.provider.getLogs({ address: this.addresses, fromBlock: cursorAt, toBlock: to })
      } catch (error: any) {
        if (window > env.WORKER_LOG_CHUNK_MIN) {
          window = Math.max(env.WORKER_LOG_CHUNK_MIN, Math.floor(window / 2))
          continue
        }
        // Stop here rather than skipping: the cursor stays behind and the range is retried.
        break
      }

      for (const log of logs) {
        outcome.logsSeen += 1
        await this.handle(log, outcome)
      }

      outcome.toBlock = to
      cursorAt = to + 1
    }

    if (outcome.toBlock >= from) {
      await this.store.setCursor(CREDITCOIN_CHAIN_KEY, CURSOR_KEY, outcome.toBlock)
    }
    return outcome
  }

  private async handle(log: Log, outcome: IndexOutcome): Promise<void> {
    let parsed
    try {
      parsed = this.iface.parseLog({ topics: [...log.topics], data: log.data })
    } catch {
      return // an event this indexer does not declare
    }
    if (!parsed) return

    switch (parsed.name) {
      case "RuleRegistered": {
        // The rule is what makes a quest matchable, so it is read from QuestASC rather than
        // reconstructed from the event, which carries only the action type.
        const questId = Number(parsed.args.questId)
        await this.indexRule(questId, Number(parsed.args.sourceChainKey))
        outcome.questsTouched += 1
        break
      }
      case "QuestAccepted": {
        const questId = Number(parsed.args.questId)
        const existing = await this.store.getQuest(questId)
        await this.store.upsertQuest({
          questId,
          participant: String(parsed.args.participant).toLowerCase(),
          sourceChainKey: Number(parsed.args.sourceChainKey),
          actionType: existing?.actionType ?? 0,
          emitter: existing?.emitter ?? "",
          token: existing?.token ?? "",
          minAmount: existing?.minAmount ?? "0",
          acceptedAtSourceHeight: Number(parsed.args.acceptedAtSourceHeight),
          accepted: true,
          completed: existing?.completed ?? false,
          updatedAt: new Date().toISOString(),
        })
        outcome.questsTouched += 1
        break
      }
      case "QuestCompleted": {
        const questId = Number(parsed.args.questId)
        const existing = await this.store.getQuest(questId)
        if (existing) {
          await this.store.upsertQuest({ ...existing, completed: true, updatedAt: new Date().toISOString() })
          outcome.questsTouched += 1
        }
        break
      }
      case "HeroMinted":
      case "HeroXPGranted":
      case "HeroLeveled": {
        await this.refreshHero(String(parsed.args.player))
        outcome.heroesTouched += 1
        break
      }
      case "QuestProofApplied": {
        // The verified-action history. QuestASC emits this only after a Merkle proof and a
        // continuity proof have both checked out, so every row here is a proved action.
        const block = await this.provider.getBlock(log.blockNumber)
        await this.store.addAction({
          replayKey: String(parsed.args.replayKey),
          questId: Number(parsed.args.questId),
          player: String(parsed.args.player).toLowerCase(),
          actionType: Number(parsed.args.actionType),
          sourceBlock: Number(parsed.args.sourceBlock),
          amount: parsed.args.amount.toString(),
          creditcoinBlock: log.blockNumber,
          createdAt: new Date(Number(block?.timestamp ?? 0) * 1000).toISOString(),
        })
        outcome.actions += 1
        break
      }
      case "BadgeMinted": {
        const block = await this.provider.getBlock(log.blockNumber)
        const badgeLevel = Number(parsed.args.badgeLevel)
        // v3 carries the rarity; v2 does not, so it is derived by the rule v3 itself applies.
        const onEvent = parsed.fragment.inputs.length === 5
        await this.store.addBadge({
          tokenId: Number(parsed.args.tokenId),
          player: String(parsed.args.to).toLowerCase(),
          questId: Number(parsed.args.questId),
          badgeLevel,
          rarity: onEvent ? Number(parsed.args.rarity) : rarityForBadgeLevel(badgeLevel),
          rarityIsDerived: !onEvent,
          creditcoinBlock: log.blockNumber,
          createdAt: new Date(Number(block?.timestamp ?? 0) * 1000).toISOString(),
        })
        outcome.badges += 1
        break
      }
      case "RewardReleased": {
        const block = await this.provider.getBlock(log.blockNumber)
        const questId = Number(parsed.args.questId)
        await this.store.addReward({
          id: `${log.transactionHash}:${questId}`,
          questId,
          recipient: String(parsed.args.recipient).toLowerCase(),
          amount: parsed.args.amount.toString(),
          creditcoinBlock: log.blockNumber,
          creditcoinTxHash: log.transactionHash,
          createdAt: new Date(Number(block?.timestamp ?? 0) * 1000).toISOString(),
        })
        outcome.rewards += 1
        break
      }
      case "RaidDamage": {
        const block = await this.provider.getBlock(log.blockNumber)
        await this.store.addRaidHit({
          seasonId: Number(parsed.args.seasonId),
          player: String(parsed.args.player).toLowerCase(),
          damage: parsed.args.damage.toString(),
          hpRemaining: parsed.args.hpRemaining.toString(),
          actionType: Number(parsed.args.actionType),
          replayKey: String(parsed.args.replayKey),
          creditcoinBlock: log.blockNumber,
          createdAt: new Date(Number(block?.timestamp ?? 0) * 1000).toISOString(),
        })
        outcome.raidHits += 1
        break
      }
      // ---------------------------------------------------------------- arena

      case "ArenaChallenged": {
        await this.store.upsertChallenge({
          challengeId: Number(parsed.args.challengeId),
          challenger: String(parsed.args.challenger).toLowerCase(),
          opponent: String(parsed.args.opponent).toLowerCase(),
          stake: parsed.args.stake.toString(),
          status: "open",
          openedAtBlock: log.blockNumber,
          updatedAt: new Date().toISOString(),
        })
        outcome.arena += 1
        break
      }
      case "ArenaAccepted": {
        await this.patchChallenge(Number(parsed.args.challengeId), (existing) => ({
          ...existing,
          status: "accepted",
          acceptedAtBlock: log.blockNumber,
        }))
        outcome.arena += 1
        break
      }
      case "ArenaResolved": {
        const winner = String(parsed.args.winner).toLowerCase()
        await this.patchChallenge(Number(parsed.args.challengeId), (existing) => ({
          ...existing,
          status: "resolved",
          winner,
          payout: parsed.args.payout.toString(),
          burned: parsed.args.burned.toString(),
          seed: String(parsed.args.seed),
          rounds: String(parsed.args.rounds),
          resolvedAtBlock: log.blockNumber,
        }))
        outcome.arena += 1
        break
      }
      case "ArenaDrawn": {
        await this.patchChallenge(Number(parsed.args.challengeId), (existing) => ({
          ...existing,
          status: "drawn",
          seed: String(parsed.args.seed),
          rounds: String(parsed.args.rounds),
          resolvedAtBlock: log.blockNumber,
        }))
        outcome.arena += 1
        break
      }
      case "ArenaCancelled":
      case "ArenaExpired": {
        await this.patchChallenge(Number(parsed.args.challengeId), (existing) => ({
          ...existing,
          status: parsed.name === "ArenaCancelled" ? "cancelled" : "expired",
          resolvedAtBlock: log.blockNumber,
        }))
        outcome.arena += 1
        break
      }

      // ---------------------------------------------------------------- loot

      case "LootMinted": {
        const block = await this.provider.getBlock(log.blockNumber)
        await this.store.addDrop({
          id: `${log.transactionHash}:${log.index}`,
          player: String(parsed.args.to).toLowerCase(),
          itemId: Number(parsed.args.itemId),
          rarity: Number(parsed.args.rarity),
          // The reason is a short bytes32 tag, "raid" or "arena", padded with zeros.
          reason: decodeTag(String(parsed.args.reason)),
          creditcoinBlock: log.blockNumber,
          creditcoinTxHash: log.transactionHash,
          createdAt: new Date(Number(block?.timestamp ?? 0) * 1000).toISOString(),
        })
        outcome.drops += 1
        break
      }
      case "LootClaimed": {
        // RaidBoss emits a four-argument LootClaimed for VAEL; only Loot's five-argument one
        // carries an item, and only that one belongs here.
        if (parsed.fragment.inputs.length !== 5) break
        const id = `${log.transactionHash}:${log.index}`
        const existing = (await this.store.drops(String(parsed.args.player))).find((d) => d.id === id)
        if (existing) break
        // The matching LootMinted in the same transaction carries the drop itself; this event adds
        // the season and the share that earned it, so the row is patched rather than duplicated.
        await this.patchDropInTx(log.transactionHash, Number(parsed.args.itemId), {
          seasonId: Number(parsed.args.seasonId),
          shareBps: Number(parsed.args.shareBps),
        })
        outcome.drops += 1
        break
      }

      // ---------------------------------------------------------------- equipment

      case "Equipped":
      case "Unequipped": {
        const block = await this.provider.getBlock(log.blockNumber)
        await this.store.addEquipmentEvent({
          id: `${log.transactionHash}:${log.index}`,
          heroTokenId: Number(parsed.args.heroTokenId),
          slot: Number(parsed.args.slot),
          itemId: Number(parsed.args.itemId),
          owner: String(parsed.args.owner).toLowerCase(),
          equipped: parsed.name === "Equipped",
          creditcoinBlock: log.blockNumber,
          createdAt: new Date(Number(block?.timestamp ?? 0) * 1000).toISOString(),
        })
        outcome.equipment += 1
        break
      }

      // ---------------------------------------------------------------- marketplace

      case "Listed": {
        await this.store.upsertListing({
          listingId: Number(parsed.args.listingId),
          seller: String(parsed.args.seller).toLowerCase(),
          itemId: Number(parsed.args.itemId),
          amount: Number(parsed.args.amount),
          price: parsed.args.price.toString(),
          status: "active",
          listedAtBlock: log.blockNumber,
          updatedAt: new Date().toISOString(),
        })
        outcome.listings += 1
        break
      }
      case "Cancelled": {
        await this.patchListing(Number(parsed.args.listingId), (existing) => ({
          ...existing,
          status: "cancelled",
          closedAtBlock: log.blockNumber,
        }))
        outcome.listings += 1
        break
      }
      case "Sold": {
        await this.patchListing(Number(parsed.args.listingId), (existing) => ({
          ...existing,
          status: "sold",
          buyer: String(parsed.args.buyer).toLowerCase(),
          fee: parsed.args.fee.toString(),
          closedAtBlock: log.blockNumber,
        }))
        outcome.listings += 1
        break
      }

      default:
        break
    }
  }

  /**
   * Update a challenge that must already exist.
   *
   * A rescan always replays ArenaChallenged before the events that follow it, so the row is there.
   * If it is not, the scan started mid-life and the row is written from what this event knows,
   * which is better than dropping the duel entirely.
   */
  private async patchChallenge(
    challengeId: number,
    patch: (existing: IndexedChallenge) => IndexedChallenge
  ): Promise<void> {
    const existing = (await this.store.getChallenge(challengeId)) ?? {
      challengeId,
      challenger: "",
      opponent: "",
      stake: "0",
      status: "open" as const,
      openedAtBlock: 0,
      updatedAt: new Date().toISOString(),
    }
    await this.store.upsertChallenge({ ...patch(existing), updatedAt: new Date().toISOString() })
  }

  private async patchListing(
    listingId: number,
    patch: (existing: IndexedListing) => IndexedListing
  ): Promise<void> {
    const existing = (await this.store.getListing(listingId)) ?? {
      listingId,
      seller: "",
      itemId: 0,
      amount: 0,
      price: "0",
      status: "active" as const,
      listedAtBlock: 0,
      updatedAt: new Date().toISOString(),
    }
    await this.store.upsertListing({ ...patch(existing), updatedAt: new Date().toISOString() })
  }

  /** Add the raid context to the drop LootMinted already recorded in the same transaction. */
  private async patchDropInTx(
    txHash: string,
    itemId: number,
    extra: { seasonId: number; shareBps: number }
  ): Promise<void> {
    const drop = (await this.store.drops()).find(
      (d) => d.creditcoinTxHash === txHash && d.itemId === itemId
    )
    if (!drop) return
    await this.store.addDrop({ ...drop, ...extra })
  }

  /** Read the rule and the participant, which together make a quest matchable. */
  private async indexRule(questId: number, sourceChainKey: number): Promise<void> {
    const ascAddress = process.env.QUEST_ASC_ADDRESS
    if (!ascAddress) return
    const asc = new Contract(ascAddress, QUEST_ASC_READ_ABI, this.provider)
    const rule = await asc.getFunction("rules").staticCall(questId)
    const existing = await this.store.getQuest(questId)

    await this.store.upsertQuest({
      questId,
      participant: existing?.participant ?? "",
      sourceChainKey,
      actionType: Number(rule[0]),
      emitter: String(rule[1]).toLowerCase(),
      token: String(rule[2]).toLowerCase(),
      minAmount: rule[3].toString(),
      ...(existing?.acceptedAtSourceHeight !== undefined
        ? { acceptedAtSourceHeight: existing.acceptedAtSourceHeight }
        : {}),
      accepted: existing?.accepted ?? false,
      completed: existing?.completed ?? false,
      updatedAt: new Date().toISOString(),
    })
  }

  /** Snapshot a hero from the contract. The events say what changed, the contract says the total. */
  private async refreshHero(player: string): Promise<void> {
    const heroAddress = process.env.VAEL_HERO_ADDRESS
    if (!heroAddress) return
    const hero = new Contract(heroAddress, VAEL_HERO_READ_ABI, this.provider)
    const tokenId: bigint = await hero.getFunction("heroOf").staticCall(player)
    if (tokenId === 0n) return
    const h = await hero.getFunction("heroByAddress").staticCall(player)

    await this.store.upsertHero({
      player: player.toLowerCase(),
      tokenId: Number(tokenId),
      level: Number(h[0]),
      xp: h[1].toString(),
      strength: Number(h[2]),
      agility: Number(h[3]),
      intellect: Number(h[4]),
      streak: Number(h[7]),
      updatedAt: new Date().toISOString(),
    })
  }
}

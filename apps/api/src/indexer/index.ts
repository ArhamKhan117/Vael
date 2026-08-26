import { Contract, Interface, JsonRpcProvider, Log } from "ethers"

import { env } from "../config/env"
import { creditcoinProvider } from "../attestcoin/config"
import { WorkerStore, createWorkerStore } from "../attestcoin/store"
import {
  INDEXER_ABI,
  QUEST_ASC_READ_ABI,
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
    ].filter((a): a is string => !!a && /^0x[0-9a-fA-F]{40}$/.test(a))
  }

  async init(): Promise<void> {
    await this.store.init()
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
      default:
        break
    }
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

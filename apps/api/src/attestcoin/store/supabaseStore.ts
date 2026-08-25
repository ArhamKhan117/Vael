import { createClient, SupabaseClient } from "@supabase/supabase-js"

import {
  IndexedAction,
  IndexedHero,
  IndexedQuest,
  IndexedRaidHit,
  IndexedReward,
  PENDING_STATUSES,
  ProofSubmission,
  WorkerCursor,
  WorkerStore,
  submissionId,
} from "./types"

/** Row shape of `proof_submissions`, which is snake_case in the database. */
interface Row {
  id: string
  quest_id_on_chain: number
  participant: string
  source_chain_key: number
  source_tx_hash: string
  source_block: number | null
  action_type: number | null
  status: string
  query_id: string | null
  creditcoin_tx_hash: string | null
  error: string | null
  attempts: number
  created_at: string
  updated_at: string
}

function toDomain(row: Row): ProofSubmission {
  const submission: ProofSubmission = {
    id: row.id,
    questIdOnChain: row.quest_id_on_chain,
    participant: row.participant,
    sourceChainKey: row.source_chain_key,
    sourceTxHash: row.source_tx_hash,
    sourceBlock: row.source_block ?? 0,
    actionType: row.action_type ?? 0,
    status: row.status as ProofSubmission["status"],
    attempts: row.attempts ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  if (row.query_id) submission.queryId = row.query_id
  if (row.creditcoin_tx_hash) submission.creditcoinTxHash = row.creditcoin_tx_hash
  if (row.error) submission.error = row.error
  return submission
}

/**
 * Supabase-backed store, using the `proof_submissions` and `worker_cursors` tables from the
 * Attestcoin migration.
 *
 * Chain state remains the source of truth: everything here is a cache the indexer could rebuild.
 * What it buys is that a restarted worker knows which source transactions it had already seen.
 */
export class SupabaseWorkerStore implements WorkerStore {
  readonly kind = "supabase" as const

  private readonly client: SupabaseClient

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  async init(): Promise<void> {
    const { error } = await this.client.from("proof_submissions").select("id").limit(1)
    if (error) {
      throw new Error(
        `proof_submissions is not reachable: ${error.message}. ` +
          "Run apps/api/database/migrations/add_attestcoin_tables.sql."
      )
    }
  }

  async upsertSubmission(
    input: Omit<ProofSubmission, "id" | "createdAt" | "updatedAt" | "attempts"> &
      Partial<Pick<ProofSubmission, "attempts">>
  ): Promise<ProofSubmission> {
    const id = submissionId(input.sourceChainKey, input.sourceTxHash, input.questIdOnChain)

    const existing = await this.getSubmission(id)
    if (existing) return existing

    const { data, error } = await this.client
      .from("proof_submissions")
      .insert({
        id,
        quest_id_on_chain: input.questIdOnChain,
        participant: input.participant.toLowerCase(),
        source_chain_key: input.sourceChainKey,
        source_tx_hash: input.sourceTxHash,
        source_block: input.sourceBlock,
        action_type: input.actionType,
        status: input.status,
        attempts: input.attempts ?? 0,
      })
      .select()
      .single()

    if (error) {
      // A concurrent worker may have inserted the same row; take theirs.
      const raced = await this.getSubmission(id)
      if (raced) return raced
      throw new Error(`failed to insert submission: ${error.message}`)
    }
    return toDomain(data as Row)
  }

  async updateSubmission(id: string, patch: Partial<ProofSubmission>): Promise<ProofSubmission> {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.status !== undefined) update.status = patch.status
    if (patch.queryId !== undefined) update.query_id = patch.queryId
    if (patch.creditcoinTxHash !== undefined) update.creditcoin_tx_hash = patch.creditcoinTxHash
    if (patch.error !== undefined) update.error = patch.error
    if (patch.attempts !== undefined) update.attempts = patch.attempts
    if (patch.sourceBlock !== undefined) update.source_block = patch.sourceBlock

    const { data, error } = await this.client
      .from("proof_submissions")
      .update(update)
      .eq("id", id)
      .select()
      .single()
    if (error) throw new Error(`failed to update submission ${id}: ${error.message}`)
    return toDomain(data as Row)
  }

  async pendingSubmissions(): Promise<ProofSubmission[]> {
    const { data, error } = await this.client
      .from("proof_submissions")
      .select("*")
      .in("status", PENDING_STATUSES)
      .order("created_at", { ascending: true })
    if (error) throw new Error(`failed to read pending submissions: ${error.message}`)
    return (data as Row[]).map(toDomain)
  }

  async getSubmission(id: string): Promise<ProofSubmission | undefined> {
    const { data } = await this.client.from("proof_submissions").select("*").eq("id", id).maybeSingle()
    return data ? toDomain(data as Row) : undefined
  }

  async allSubmissions(): Promise<ProofSubmission[]> {
    const { data, error } = await this.client
      .from("proof_submissions")
      .select("*")
      .order("created_at", { ascending: true })
    if (error) throw new Error(`failed to read submissions: ${error.message}`)
    return (data as Row[]).map(toDomain)
  }

  async getCursor(chainKey: number, emitter: string): Promise<WorkerCursor | undefined> {
    const { data } = await this.client
      .from("worker_cursors")
      .select("*")
      .eq("chain_key", chainKey)
      .eq("emitter", emitter.toLowerCase())
      .maybeSingle()
    if (!data) return undefined
    return {
      chainKey: data.chain_key,
      emitter: data.emitter,
      lastBlock: Number(data.last_block),
      updatedAt: data.updated_at,
    }
  }

  async setCursor(chainKey: number, emitter: string, lastBlock: number): Promise<void> {
    const { error } = await this.client.from("worker_cursors").upsert(
      {
        chain_key: chainKey,
        emitter: emitter.toLowerCase(),
        last_block: lastBlock,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chain_key,emitter" }
    )
    if (error) throw new Error(`failed to write cursor: ${error.message}`)
  }

  // ---------------------------------------------------------------- index

  async upsertQuest(quest: IndexedQuest): Promise<void> {
    const { error } = await this.client.from("indexed_quests").upsert(
      {
        quest_id: quest.questId,
        participant: quest.participant.toLowerCase(),
        source_chain_key: quest.sourceChainKey,
        action_type: quest.actionType,
        emitter: quest.emitter.toLowerCase(),
        token: quest.token.toLowerCase(),
        min_amount: quest.minAmount,
        accepted_at_source_height: quest.acceptedAtSourceHeight ?? null,
        accepted: quest.accepted,
        completed: quest.completed,
        updated_at: quest.updatedAt,
      },
      { onConflict: "quest_id" }
    )
    if (error) throw new Error(`failed to index quest ${quest.questId}: ${error.message}`)
  }

  async getQuest(questId: number): Promise<IndexedQuest | undefined> {
    const { data } = await this.client
      .from("indexed_quests")
      .select("*")
      .eq("quest_id", questId)
      .maybeSingle()
    return data ? questFromRow(data) : undefined
  }

  async openQuestsFor(participant: string): Promise<IndexedQuest[]> {
    const { data, error } = await this.client
      .from("indexed_quests")
      .select("*")
      .eq("participant", participant.toLowerCase())
      .eq("accepted", true)
      .eq("completed", false)
      .order("updated_at", { ascending: false })
    if (error) throw new Error(`failed to read open quests: ${error.message}`)
    return (data ?? []).map(questFromRow)
  }

  async allQuests(): Promise<IndexedQuest[]> {
    const { data, error } = await this.client.from("indexed_quests").select("*")
    if (error) throw new Error(`failed to read quests: ${error.message}`)
    return (data ?? []).map(questFromRow)
  }

  async upsertHero(hero: IndexedHero): Promise<void> {
    const { error } = await this.client.from("hero_snapshots").upsert(
      {
        address: hero.player.toLowerCase(),
        token_id: hero.tokenId,
        level: hero.level,
        xp: hero.xp,
        strength: hero.strength,
        agility: hero.agility,
        intellect: hero.intellect,
        streak: hero.streak,
        updated_at: hero.updatedAt,
      },
      { onConflict: "address" }
    )
    if (error) throw new Error(`failed to index hero: ${error.message}`)
  }

  async getHero(player: string): Promise<IndexedHero | undefined> {
    const { data } = await this.client
      .from("hero_snapshots")
      .select("*")
      .eq("address", player.toLowerCase())
      .maybeSingle()
    return data ? heroFromRow(data) : undefined
  }

  async allHeroes(): Promise<IndexedHero[]> {
    const { data, error } = await this.client.from("hero_snapshots").select("*")
    if (error) throw new Error(`failed to read heroes: ${error.message}`)
    return (data ?? []).map(heroFromRow)
  }

  async addRaidHit(hit: IndexedRaidHit): Promise<void> {
    // The replay key makes a hit idempotent, so a re-scan of the same range cannot double-count.
    const { error } = await this.client.from("raid_damage").upsert(
      {
        season_id: hit.seasonId,
        player: hit.player.toLowerCase(),
        damage: hit.damage,
        query_id: hit.replayKey,
        creditcoin_tx_hash: null,
        created_at: hit.createdAt,
      },
      { onConflict: "season_id,query_id" }
    )
    if (error) throw new Error(`failed to index raid hit: ${error.message}`)
  }

  async raidHits(seasonId: number): Promise<IndexedRaidHit[]> {
    const { data, error } = await this.client
      .from("raid_damage")
      .select("*")
      .eq("season_id", seasonId)
      .order("created_at", { ascending: false })
    if (error) throw new Error(`failed to read raid hits: ${error.message}`)
    return (data ?? []).map((row: any) => ({
      seasonId: row.season_id,
      player: row.player,
      damage: String(row.damage),
      hpRemaining: "0",
      actionType: 0,
      replayKey: row.query_id,
      creditcoinBlock: 0,
      createdAt: row.created_at,
    }))
  }

  async addAction(action: IndexedAction): Promise<void> {
    // The replay key is unique on chain, so a rescan of the same range is a no-op here.
    const { error } = await this.client.from("verified_actions").upsert(
      {
        replay_key: action.replayKey,
        quest_id: action.questId,
        player: action.player.toLowerCase(),
        action_type: action.actionType,
        source_block: action.sourceBlock,
        amount: action.amount,
        creditcoin_block: action.creditcoinBlock,
        created_at: action.createdAt,
      },
      { onConflict: "replay_key" }
    )
    if (error) throw new Error(`failed to index verified action: ${error.message}`)
  }

  async actions(player?: string): Promise<IndexedAction[]> {
    let query = this.client
      .from("verified_actions")
      .select("*")
      .order("creditcoin_block", { ascending: false })
    if (player) query = query.eq("player", player.toLowerCase())
    const { data, error } = await query
    if (error) throw new Error(`failed to read verified actions: ${error.message}`)
    return (data ?? []).map((row: any) => ({
      replayKey: row.replay_key,
      questId: Number(row.quest_id),
      player: row.player,
      actionType: Number(row.action_type),
      sourceBlock: Number(row.source_block),
      amount: String(row.amount ?? "0"),
      creditcoinBlock: Number(row.creditcoin_block),
      createdAt: row.created_at,
    }))
  }

  async addReward(reward: IndexedReward): Promise<void> {
    const { error } = await this.client.from("reward_releases").upsert(
      {
        id: reward.id,
        quest_id: reward.questId,
        recipient: reward.recipient.toLowerCase(),
        amount: reward.amount,
        creditcoin_block: reward.creditcoinBlock,
        creditcoin_tx_hash: reward.creditcoinTxHash,
        created_at: reward.createdAt,
      },
      { onConflict: "id" }
    )
    if (error) throw new Error(`failed to index reward release: ${error.message}`)
  }

  async allRewards(): Promise<IndexedReward[]> {
    const { data, error } = await this.client.from("reward_releases").select("*")
    if (error) throw new Error(`failed to read reward releases: ${error.message}`)
    return (data ?? []).map((row: any) => ({
      id: row.id,
      questId: Number(row.quest_id),
      recipient: row.recipient,
      amount: String(row.amount ?? "0"),
      creditcoinBlock: Number(row.creditcoin_block),
      creditcoinTxHash: row.creditcoin_tx_hash,
      createdAt: row.created_at,
    }))
  }
}

function questFromRow(row: any): IndexedQuest {
  const quest: IndexedQuest = {
    questId: row.quest_id,
    participant: row.participant,
    sourceChainKey: row.source_chain_key,
    actionType: row.action_type,
    emitter: row.emitter,
    token: row.token,
    minAmount: String(row.min_amount ?? "0"),
    accepted: Boolean(row.accepted),
    completed: Boolean(row.completed),
    updatedAt: row.updated_at,
  }
  if (row.accepted_at_source_height != null) {
    quest.acceptedAtSourceHeight = Number(row.accepted_at_source_height)
  }
  return quest
}

function heroFromRow(row: any): IndexedHero {
  return {
    player: row.address,
    tokenId: Number(row.token_id ?? 0),
    level: Number(row.level ?? 1),
    xp: String(row.xp ?? "0"),
    strength: Number(row.strength ?? 0),
    agility: Number(row.agility ?? 0),
    intellect: Number(row.intellect ?? 0),
    streak: Number(row.streak ?? 0),
    updatedAt: row.updated_at,
  }
}

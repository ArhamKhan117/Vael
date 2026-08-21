import { createClient, SupabaseClient } from "@supabase/supabase-js"

import {
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
}

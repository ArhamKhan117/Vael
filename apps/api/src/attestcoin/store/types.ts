/**
 * Worker state, and the two places it can live.
 *
 * The state machine is the one in docs/SPEC.md section 6. A submission is written **before** any
 * network work happens, so a crash between observing a Sepolia log and proving it leaves a row
 * behind rather than losing the action entirely. Everything else is a transition on that row.
 */

export type SubmissionStatus =
  | "detected"
  | "attesting"
  | "proving"
  | "submitted"
  | "verified"
  | "failed"

export interface ProofSubmission {
  /** Stable id: one row per source transaction per quest. */
  id: string
  questIdOnChain: number
  participant: string
  sourceChainKey: number
  sourceTxHash: string
  sourceBlock: number
  actionType: number
  status: SubmissionStatus
  /** Log-scoped replay key, once the submission has been through QuestASC. */
  queryId?: string
  creditcoinTxHash?: string
  error?: string
  attempts: number
  createdAt: string
  updatedAt: string
}

/**
 * An indexed quest, as the chain describes it.
 *
 * The worker needs this to answer "which quest does this Sepolia log belong to?" for a third-party
 * protocol whose event knows nothing about Vael. Everything here is derived from Creditcoin events,
 * so the index is rebuildable and never a source of truth.
 */
export interface IndexedQuest {
  questId: number
  participant: string
  sourceChainKey: number
  actionType: number
  emitter: string
  token: string
  minAmount: string
  /** Set once QuestAccepted is seen, which is also the source-height anchor. */
  acceptedAtSourceHeight?: number
  accepted: boolean
  completed: boolean
  updatedAt: string
}

/** A hero, as the chain describes it. */
export interface IndexedHero {
  player: string
  tokenId: number
  level: number
  xp: string
  strength: number
  agility: number
  intellect: number
  streak: number
  updatedAt: string
}

/** One verified hit on the boss. */
export interface IndexedRaidHit {
  seasonId: number
  player: string
  damage: string
  hpRemaining: string
  actionType: number
  replayKey: string
  creditcoinBlock: number
  createdAt: string
}

export interface WorkerCursor {
  chainKey: number
  emitter: string
  lastBlock: number
  updatedAt: string
}

/**
 * Everything the worker needs to survive a restart.
 *
 * Two implementations: a JSON file for a single operator with no infrastructure, and Supabase for
 * a deployed worker. The interface is deliberately small so a third one stays cheap.
 */
export interface WorkerStore {
  readonly kind: "file" | "supabase"

  init(): Promise<void>

  /** Insert if absent, returning the existing row otherwise. Keyed by chain, tx, and quest. */
  upsertSubmission(
    submission: Omit<ProofSubmission, "id" | "createdAt" | "updatedAt" | "attempts"> &
      Partial<Pick<ProofSubmission, "attempts">>
  ): Promise<ProofSubmission>

  updateSubmission(id: string, patch: Partial<ProofSubmission>): Promise<ProofSubmission>

  /** Rows that still have work to do, oldest first. */
  pendingSubmissions(): Promise<ProofSubmission[]>

  getSubmission(id: string): Promise<ProofSubmission | undefined>

  allSubmissions(): Promise<ProofSubmission[]>

  getCursor(chainKey: number, emitter: string): Promise<WorkerCursor | undefined>

  setCursor(chainKey: number, emitter: string, lastBlock: number): Promise<void>

  // ---------------------------------------------------------------- index

  upsertQuest(quest: IndexedQuest): Promise<void>

  getQuest(questId: number): Promise<IndexedQuest | undefined>

  /**
   * Quests this player has accepted and not completed, most recently accepted first.
   *
   * This is how a third-party log is resolved to a quest: a Uniswap `Swap` cannot name a quest, so
   * the worker asks which of the player's open quests that action could satisfy.
   */
  openQuestsFor(participant: string): Promise<IndexedQuest[]>

  allQuests(): Promise<IndexedQuest[]>

  upsertHero(hero: IndexedHero): Promise<void>

  getHero(player: string): Promise<IndexedHero | undefined>

  allHeroes(): Promise<IndexedHero[]>

  addRaidHit(hit: IndexedRaidHit): Promise<void>

  raidHits(seasonId: number): Promise<IndexedRaidHit[]>
}

/** Statuses that still need the worker to do something. */
export const PENDING_STATUSES: SubmissionStatus[] = [
  "detected",
  "attesting",
  "proving",
  "submitted",
]

export function submissionId(chainKey: number, sourceTxHash: string, questId: number): string {
  return `${chainKey}:${sourceTxHash.toLowerCase()}:${questId}`
}

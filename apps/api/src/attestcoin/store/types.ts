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

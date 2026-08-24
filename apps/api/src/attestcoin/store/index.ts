import { join } from "node:path"

import { FileWorkerStore } from "./fileStore"
import { SupabaseWorkerStore } from "./supabaseStore"
import { WorkerStore } from "./types"

export * from "./types"
export { FileWorkerStore } from "./fileStore"
export { SupabaseWorkerStore } from "./supabaseStore"

/** Where the file store lives when Supabase is not configured. Gitignored. */
export const DEFAULT_STATE_DIR = join(__dirname, "../../../.state")

/**
 * Pick a store from `WORKER_STORE`, which defaults to `file`.
 *
 * Explicit rather than inferred. Deciding from whether `SUPABASE_URL` happened to be set meant an
 * operator who configured Supabase for the AI cache silently moved the worker's state with it, and
 * the only symptom was a worker that appeared to have forgotten everything. Choosing `supabase`
 * without the credentials is an error, not a quiet fallback: falling back would hide the same
 * problem in the other direction.
 */
export function createWorkerStore(stateDir: string = DEFAULT_STATE_DIR): WorkerStore {
  if (process.env.WORKER_STORE === "supabase") {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key || !/^https?:\/\//.test(url)) {
      throw new Error(
        "WORKER_STORE=supabase but SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set."
      )
    }
    return new SupabaseWorkerStore(url, key)
  }
  return new FileWorkerStore(stateDir)
}

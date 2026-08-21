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
 * Pick a store from the environment.
 *
 * Supabase when `SUPABASE_URL` is a real URL and a service role key is present; otherwise a JSON
 * file. The worker must be runnable by someone who has a funded testnet key and nothing else, so
 * the absence of Supabase is a supported configuration rather than an error.
 */
export function createWorkerStore(stateDir: string = DEFAULT_STATE_DIR): WorkerStore {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const usable =
    !!url && !!key && /^https?:\/\//.test(url) && !url.includes("FILL_ME") && key.length > 20

  if (usable) return new SupabaseWorkerStore(url, key)
  return new FileWorkerStore(stateDir)
}

/**
 * Run the Creditcoin indexer on its own, until interrupted.
 *
 *   pnpm --filter @vael/api indexer
 *
 * The worker also indexes as part of each tick, so this is for running the two separately: an
 * indexer that keeps the site's read paths current needs none of the worker's keys, and an
 * operator who wants one without the other should not have to take both.
 *
 * Needs: CREDITCOIN_RPC_URL, the contract addresses it watches, and WORKER_STORE with its
 * credentials. It signs nothing, so it needs no private key at all. The loop is the same one
 * production runs, from src/indexer/loop.ts.
 */
import "dotenv/config"

import { runIndexer } from "../src/indexer/loop"

const INTERVAL_MS = Number(process.env.INDEXER_INTERVAL_MS ?? 20_000)

let stopping = false
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n[indexer] ${signal} received, stopping after the current scan`)
    stopping = true
    setTimeout(() => process.exit(0), 500)
  })
}

runIndexer(INTERVAL_MS, () => stopping).catch((error) => {
  console.error(error)
  process.exit(1)
})

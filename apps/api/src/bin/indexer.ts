/**
 * Production entry point for the Creditcoin indexer.
 *
 *   pnpm --filter @vael/api build
 *   node apps/api/dist/bin/indexer.js
 *
 * Signs nothing and needs no private key: it reads Creditcoin's own events into the store, which
 * is what the site's read paths are assembled from. The loop itself is in src/indexer/loop.ts,
 * shared with the tsx entry point in scripts/.
 */
import "dotenv/config"

import { runIndexer } from "../indexer/loop"

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
  console.error("[indexer] fatal:", error instanceof Error ? error.message : error)
  process.exit(1)
})

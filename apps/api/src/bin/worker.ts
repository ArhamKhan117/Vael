/**
 * Production entry point for the Attestcoin proof worker.
 *
 *   pnpm --filter @vael/api build
 *   node apps/api/dist/bin/worker.js
 *
 * The same worker `scripts/worker.ts` runs under tsx, compiled rather than transpiled on the fly.
 * It lives under src so `tsc -p .` emits it; scripts/ is deliberately outside rootDir.
 *
 * State persists to Supabase when configured, otherwise to apps/api/.state/worker-state.json, so
 * killing and restarting the process resumes rather than losing work in flight.
 */
import "dotenv/config"

import { AttestcoinWorker } from "../attestcoin/worker"

const worker = new AttestcoinWorker()

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n[worker] ${signal} received, stopping after the current step`)
    worker.stop()
    setTimeout(() => process.exit(0), 500)
  })
}

worker.start().catch((error) => {
  console.error("[worker] fatal:", error instanceof Error ? error.message : error)
  process.exit(1)
})

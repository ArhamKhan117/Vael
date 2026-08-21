/**
 * Run the Attestcoin proof worker until interrupted.
 *
 *   pnpm --filter @vael/api worker
 *
 * State persists to Supabase when configured, otherwise to apps/api/.state/worker-state.json, so
 * killing and restarting the process resumes rather than losing work in flight.
 */
import { AttestcoinWorker } from "../src/attestcoin/worker"

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

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
 * credentials. It signs nothing, so it needs no private key at all.
 */
import "dotenv/config"

import { CreditcoinIndexer } from "../src/indexer"

const INTERVAL_MS = Number(process.env.INDEXER_INTERVAL_MS ?? 20_000)

let stopping = false
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n[indexer] ${signal} received, stopping after the current scan`)
    stopping = true
    setTimeout(() => process.exit(0), 500)
  })
}

function stamp() {
  return new Date().toISOString().slice(11, 19)
}

async function main() {
  const indexer = new CreditcoinIndexer()
  await indexer.init()
  console.log(`[indexer] scanning every ${INTERVAL_MS / 1000}s`)

  for (;;) {
    if (stopping) return
    try {
      const outcome = await indexer.scanOnce()
      const moved = [
        ["quest", outcome.questsTouched],
        ["hero", outcome.heroesTouched],
        ["raid hit", outcome.raidHits],
        ["action", outcome.actions],
        ["reward", outcome.rewards],
        ["badge", outcome.badges],
        ["arena", outcome.arena],
        ["drop", outcome.drops],
        ["equipment", outcome.equipment],
        ["listing", outcome.listings],
      ].filter(([, count]) => (count as number) > 0)

      if (outcome.toBlock >= outcome.fromBlock) {
        console.log(
          `[${stamp()}] ${outcome.fromBlock}..${outcome.toBlock}  ${outcome.logsSeen} logs` +
            (moved.length > 0 ? `  ${moved.map(([l, c]) => `${c} ${l}`).join(", ")}` : "")
        )
      }
    } catch (error) {
      // A scan that fails is retried on the next tick. The cursor only advances on success, so a
      // failed scan costs time rather than data.
      console.error(`[${stamp()}] scan failed: ${(error as Error).message}`)
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
  }
}

main().catch((error) => {
  console.error("[indexer] fatal:", error instanceof Error ? error.message : error)
  process.exit(1)
})

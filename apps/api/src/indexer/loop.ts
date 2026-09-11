import { CreditcoinIndexer } from "./index"

/**
 * The indexer's loop: scan to the head, go back for any metadata that was missed, wait, repeat.
 *
 * One loop for both entry points. `src/bin/indexer.ts` is what production runs from `dist/` and
 * `scripts/indexer.ts` is the same thing under tsx; they carried two copies of this and a change
 * to one was a change to neither in particular, which is how the metadata retry ran only under
 * tsx while the built indexer went on showing "Quest #37".
 *
 * A scan that fails is retried on the next tick. The cursor only advances on success, so a failed
 * scan costs time rather than data.
 */
export async function runIndexer(intervalMs: number, stopping: () => boolean): Promise<void> {
  const indexer = new CreditcoinIndexer()
  await indexer.init()
  console.log(`[indexer] scanning every ${intervalMs / 1000}s`)

  for (;;) {
    if (stopping()) return
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
        ["campaign", outcome.campaigns],
      ].filter(([, count]) => (count as number) > 0)

      if (outcome.toBlock >= outcome.fromBlock) {
        console.log(
          `[${stamp()}] ${outcome.fromBlock}..${outcome.toBlock}  ${outcome.logsSeen} logs` +
            (moved.length > 0 ? `  ${moved.map(([l, c]) => `${c} ${l}`).join(", ")}` : "")
        )
      }

      // Quests whose document the gateway had not seen at index time. A few per tick, on a
      // backoff, so a board never keeps showing "Quest #37" for a quest with a name.
      const filled = await indexer.recatalogueUntitled()
      if (filled > 0) {
        console.log(`[${stamp()}] fetched the metadata of ${filled} quest(s) catalogued without it`)
      }
    } catch (error) {
      console.error(`[${stamp()}] scan failed: ${(error as Error).message}`)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

function stamp() {
  return new Date().toISOString().slice(11, 19)
}

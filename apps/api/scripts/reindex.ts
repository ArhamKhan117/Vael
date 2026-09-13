/**
 * Rewind the Creditcoin index cursor so the next scan replays history.
 *
 * Adding a handler for an event the indexer did not previously decode leaves a hole: the cursor has
 * already passed those blocks and nothing will ever go back for them. This is how that hole is
 * filled. Every table the indexer writes is keyed so a replay is idempotent (replay key, token id,
 * transaction hash and quest id), so re-running over blocks already seen changes nothing.
 *
 *   pnpm --filter @vael/api reindex            # from the earliest contract deployment
 *   pnpm --filter @vael/api reindex 5459000    # from a specific height
 *
 * The scan itself is done by the worker, or by running this with --scan to do it here.
 */
import "dotenv/config"

import { createWorkerStore } from "../src/attestcoin/store"
import { CreditcoinIndexer } from "../src/indexer"

/**
 * Block of the earliest contract this indexer watches, from docs/ADDRESSES.md.
 *
 * The current core was deployed in blocks 5465160 to 5465168. This moves forward with each
 * redeploy rather than staying at the first deployment, because scanning earlier only re-reads
 * events from superseded contracts.
 *
 * BadgeNFT is the exception and the reason this is not simply block 5465160. It survived the
 * redeploy, so the twenty badges players hold were minted at earlier heights and were never
 * re-minted. Starting at 5465160 would lose all twenty from the index while leaving them on the
 * chain, so the floor stays at the block BadgeNFT itself was deployed in.
 */
const EARLIEST_DEPLOYMENT = 5463522
const CREDITCOIN_CHAIN_KEY = 102031
const CURSOR_KEY = "creditcoin-index"

async function main() {
  const args = process.argv.slice(2)
  const scan = args.includes("--scan")
  const fromArg = args.find((arg) => /^\d+$/.test(arg))
  const from = fromArg ? Number(fromArg) : EARLIEST_DEPLOYMENT

  const store = createWorkerStore()
  await store.init()

  const before = await store.getCursor(CREDITCOIN_CHAIN_KEY, CURSOR_KEY)
  // The indexer resumes at lastBlock + 1, so the cursor is set one below the first wanted block.
  await store.setCursor(CREDITCOIN_CHAIN_KEY, CURSOR_KEY, from - 1)
  console.log(`cursor ${before?.lastBlock ?? "unset"} -> ${from - 1}, next scan starts at ${from}`)

  if (!scan) {
    console.log("run the worker to perform the scan, or re-run with --scan")
    return
  }

  const indexer = new CreditcoinIndexer(store)
  await indexer.init()

  // scanOnce advances by one bounded window and reports toBlock < fromBlock once caught up.
  for (;;) {
    const outcome = await indexer.scanOnce()
    if (outcome.toBlock < outcome.fromBlock) break
    const counts = [
      ["quests", outcome.questsTouched],
      ["heroes", outcome.heroesTouched],
      ["raid hits", outcome.raidHits],
      ["actions", outcome.actions],
      ["rewards", outcome.rewards],
      ["badges", outcome.badges],
      ["arena", outcome.arena],
      ["drops", outcome.drops],
      ["equipment", outcome.equipment],
      ["listings", outcome.listings],
      ["campaigns", outcome.campaigns],
    ] as const
    const summary = counts
      .filter(([, n]) => n > 0)
      .map(([label, n]) => `${n} ${label}`)
      .join(", ")
    console.log(
      `${outcome.fromBlock}-${outcome.toBlock}: ${outcome.logsSeen} logs` +
        (summary ? `, ${summary}` : "")
    )
  }

  console.log("done")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

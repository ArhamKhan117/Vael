import { runQuestAcceptedWatcherOnce } from "../services/questEventWatcher"

const POLL_INTERVAL_MS = 60_000

let watcherInProgress = false

async function pollQuestAccepted() {
  if (watcherInProgress) {
    console.log("[WATCHER] Skipped (previous run still in progress)")
    return
  }
  watcherInProgress = true
  try {
    await runQuestAcceptedWatcherOnce()
  } catch (error: any) {
    console.error("[WATCHER] Failed:", error?.message || error)
  } finally {
    watcherInProgress = false
  }
}

/**
 * Mirrors QuestAccepted events from Creditcoin into the cache.
 *
 * There is no completion polling here on purpose. A quest completes only when QuestASC
 * verifies an Attestcoin proof on-chain; the proof worker lands in milestone 3.
 */
export function startQuestPolling() {
  void pollQuestAccepted()
  setInterval(pollQuestAccepted, POLL_INTERVAL_MS)
}

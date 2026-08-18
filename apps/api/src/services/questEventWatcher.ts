import { parseAbiItem } from "viem"

import { env } from "../config/env"
import { publicClient, questManagerAddress } from "../lib/contracts"
import { getCronCursor, setCronCursor, setQuestAcceptedAt } from "./dbService"

const QUEST_ACCEPTED_EVENT = parseAbiItem(
  "event QuestAccepted(uint256 indexed questId, address indexed participant)"
)

const CURSOR_KEY = "quest_accepted_cursor"

/** How far back to start when there is no cursor yet. */
const INITIAL_LOOKBACK_BLOCKS = 5_000n

/**
 * Mirrors QuestAccepted from Creditcoin into the cache so the UI can show when a player
 * accepted a quest without a contract read per row.
 *
 * The Creditcoin RPC times out eth_getLogs after 10 seconds, so the scan is chunked and the
 * window halves whenever a chunk is rejected, down to WORKER_LOG_CHUNK_MIN.
 */
export async function runQuestAcceptedWatcherOnce() {
  if (!questManagerAddress) {
    console.warn("[WATCHER] QUEST_MANAGER_ADDRESS missing, skipping")
    return
  }

  const latestBlock = await publicClient.getBlockNumber()

  const storedCursor = await getCronCursor(CURSOR_KEY)
  const startBlock = storedCursor
    ? BigInt(storedCursor) + 1n
    : latestBlock > INITIAL_LOOKBACK_BLOCKS
      ? latestBlock - INITIAL_LOOKBACK_BLOCKS
      : 0n

  if (startBlock > latestBlock) return

  const minChunk = BigInt(env.WORKER_LOG_CHUNK_MIN)
  let chunk = BigInt(env.WORKER_LOG_CHUNK_MAX)
  let fromBlock = startBlock
  let matched = 0
  // Only advance the cursor past ranges that actually succeeded.
  let scannedTo = startBlock - 1n

  while (fromBlock <= latestBlock) {
    const toBlock = fromBlock + chunk - 1n > latestBlock ? latestBlock : fromBlock + chunk - 1n

    let logs
    try {
      logs = await publicClient.getLogs({
        address: questManagerAddress,
        event: QUEST_ACCEPTED_EVENT,
        fromBlock,
        toBlock,
      })
    } catch (error: any) {
      if (chunk > minChunk) {
        chunk = chunk / 2n > minChunk ? chunk / 2n : minChunk
        continue
      }
      console.warn(
        `[WATCHER] getLogs failed at block ${fromBlock} with the minimum window:`,
        error?.message || error
      )
      break
    }

    for (const log of logs) {
      const questId = log.args.questId
      if (questId === undefined) continue
      try {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
        const acceptedAt = new Date(Number(block.timestamp) * 1000).toISOString()
        await setQuestAcceptedAt(Number(questId), acceptedAt)
        matched += 1
      } catch (error: any) {
        console.warn("[WATCHER] Failed to update accepted_at:", error?.message || error)
      }
    }

    scannedTo = toBlock
    fromBlock = toBlock + 1n
  }

  if (scannedTo >= startBlock) {
    await setCronCursor(CURSOR_KEY, scannedTo.toString())
  }
  if (matched > 0) {
    console.log(`[WATCHER] QuestAccepted updates: ${matched}`)
  }
}

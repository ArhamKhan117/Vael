import { JsonRpcProvider, Log } from "ethers"

import { env } from "../config/env"
import { Result, err, ok } from "./config"

/**
 * Sepolia log observation, bounded so it survives public RPC endpoints.
 *
 * Every scan is chunked, the window halves whenever an endpoint rejects a range, and the cursor
 * only advances over ranges that actually succeeded. Public endpoints cap `eth_getLogs` anywhere
 * between 10 and 10,000 blocks and give no consistent error for it, so the window has to adapt
 * rather than be configured once.
 */
export interface ScanRequest {
  provider: JsonRpcProvider
  emitters: string[]
  topics: (string | null)[]
  fromBlock: number
  toBlock: number
}

export interface ScanOutcome {
  logs: Log[]
  /** Highest block actually covered. The cursor must not advance past this. */
  scannedTo: number
  chunksTried: number
  finalWindow: number
}

export async function scanLogs(request: ScanRequest): Promise<Result<ScanOutcome>> {
  const minWindow = env.WORKER_LOG_CHUNK_MIN
  let window = env.WORKER_LOG_CHUNK_MAX
  let from = request.fromBlock
  let scannedTo = request.fromBlock - 1
  let chunksTried = 0
  const logs: Log[] = []

  if (request.emitters.length === 0) {
    return ok({ logs, scannedTo: request.toBlock, chunksTried: 0, finalWindow: window })
  }

  while (from <= request.toBlock) {
    const to = Math.min(from + window - 1, request.toBlock)
    chunksTried += 1
    try {
      const found = await request.provider.getLogs({
        address: request.emitters,
        topics: request.topics,
        fromBlock: from,
        toBlock: to,
      })
      logs.push(...found)
      scannedTo = to
      from = to + 1
    } catch (error: any) {
      if (window > minWindow) {
        window = Math.max(minWindow, Math.floor(window / 2))
        continue
      }
      // At the minimum window there is nothing left to narrow. Return what was covered so far so
      // the caller can persist a cursor that is behind but correct, rather than losing the range.
      return err(
        `getLogs failed at block ${from} with the minimum window: ` +
          `${error?.shortMessage ?? error?.message ?? String(error)}`
      )
    }
  }

  return ok({ logs, scannedTo, chunksTried, finalWindow: window })
}

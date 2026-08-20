import { JsonRpcProvider } from "ethers"

import { env } from "../config/env"
import { ATTESTATION_POLL_INTERVAL_MS, Result, err, ok } from "./config"
import { getAttestedFrontier } from "./chainInfo"

/**
 * Wait until the Attestcoin attestors have covered a source block.
 *
 * This is a hand-rolled poll rather than the SDK's precompile-backed wait, deliberately. That
 * helper defaults to a 60 second timeout, and the measured Sepolia attestation lag is 7 to 8.6
 * minutes, so it times out on essentially every real transaction. The ceiling here is
 * ATTESTATION_WAIT_TIMEOUT_MS, 20 minutes by default.
 *
 * Returns a Result rather than throwing, because "not attested yet" is an ordinary outcome the
 * caller has to handle, not an exception.
 */
export interface AttestationWaitOutcome {
  attestedHeight: bigint
  waitedMs: number
  polls: number
}

export interface WaitOptions {
  intervalMs?: number
  timeoutMs?: number
  onPoll?: (info: { attestedHeight: bigint; targetHeight: bigint; elapsedMs: number }) => void
}

export async function waitForAttestation(
  provider: JsonRpcProvider,
  chainKey: number,
  targetHeight: bigint,
  options: WaitOptions = {}
): Promise<Result<AttestationWaitOutcome>> {
  const intervalMs = options.intervalMs ?? ATTESTATION_POLL_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? env.ATTESTATION_WAIT_TIMEOUT_MS
  const startedAt = Date.now()
  let polls = 0

  for (;;) {
    polls += 1
    const frontier = await getAttestedFrontier(provider, chainKey)

    if (!frontier.ok) {
      // A transient RPC failure must not end the wait; the ceiling below still bounds it.
      if (Date.now() - startedAt >= timeoutMs) {
        return err(`attestation wait timed out after ${polls} polls: ${frontier.error}`)
      }
      await sleep(intervalMs)
      continue
    }

    if (!frontier.value.exists) {
      return err(`chainKey ${chainKey} is not attested at all`)
    }

    const elapsedMs = Date.now() - startedAt
    options.onPoll?.({
      attestedHeight: frontier.value.height,
      targetHeight,
      elapsedMs,
    })

    if (frontier.value.height >= targetHeight) {
      return ok({ attestedHeight: frontier.value.height, waitedMs: elapsedMs, polls })
    }

    if (elapsedMs >= timeoutMs) {
      return err(
        `attestation wait timed out after ${Math.round(elapsedMs / 1000)}s: ` +
          `frontier ${frontier.value.height}, need ${targetHeight}`
      )
    }

    await sleep(intervalMs)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
 *
 * **Pass the block above the one you want to prove.** A continuity proof is a chain between two
 * attested endpoints that bracket the block, so an attested height at or below the block is not
 * enough: the proof builder needs one strictly above it too. Waiting only for
 * `frontier >= sourceBlock` produces a proof builder that answers "Cannot build continuity proof
 * ... without both lower and upper continuity bounds". `proveSourceBlock` below does this for you.
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

/**
 * Wait until a source block is provable, which needs an attested endpoint strictly above it.
 * Attestations land every 10 source blocks, so this is normally one extra interval.
 */
export function waitUntilProvable(
  provider: JsonRpcProvider,
  chainKey: number,
  sourceBlock: bigint,
  options: WaitOptions = {}
): Promise<Result<AttestationWaitOutcome>> {
  return waitForAttestation(provider, chainKey, sourceBlock + 1n, options)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

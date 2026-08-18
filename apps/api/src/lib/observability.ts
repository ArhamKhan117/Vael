/**
 * Observability: success and failure counters plus latency for the calls that can fail
 * on rate-limited public RPC endpoints.
 */

export interface Metrics {
  /** Attestcoin Proof Builder requests. */
  proofBuilder: { success: number; failure: number; totalLatencyMs: number }
  /** executeForQuest submissions to QuestASC on Creditcoin. */
  submitProof: { success: number; failure: number }
}

const metrics: Metrics = {
  proofBuilder: { success: 0, failure: 0, totalLatencyMs: 0 },
  submitProof: { success: 0, failure: 0 },
}

export function getMetrics(): Metrics {
  return { ...metrics }
}

export function recordProofBuilderCall(success: boolean, latencyMs: number): void {
  if (success) {
    metrics.proofBuilder.success++
  } else {
    metrics.proofBuilder.failure++
  }
  metrics.proofBuilder.totalLatencyMs += latencyMs
}

export function recordSubmitProof(success: boolean): void {
  if (success) metrics.submitProof.success++
  else metrics.submitProof.failure++
}

export function logObservability(): void {
  const p = metrics.proofBuilder
  const total = p.success + p.failure
  const avgLatency = total > 0 ? Math.round(p.totalLatencyMs / total) : 0
  console.log(
    `[OBSERVABILITY] ProofBuilder: ${p.success} ok, ${p.failure} fail, avg ${avgLatency}ms | ` +
      `SubmitProof: ${metrics.submitProof.success} ok, ${metrics.submitProof.failure} fail`
  )
}

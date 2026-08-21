/**
 * The shared proof pipeline used by every end-to-end script: wait for attestation, fetch the
 * proof right before submitting, re-derive the Merkle root locally, preflight keylessly, submit.
 *
 * Kept in one place so the wild-action runs and the portal run exercise the same code, rather
 * than each script growing its own slightly different version of the flow.
 */
import { Contract, JsonRpcProvider, Wallet } from "ethers"

import { SEPOLIA_CHAIN_KEY } from "../../src/attestcoin/config"
import { waitUntilProvable } from "../../src/attestcoin/attest"
import { SourceTxProof, fetchProof, verifyMerkleRootLocally } from "../../src/attestcoin/prove"
import { preflight, submitProof } from "../../src/attestcoin/submit"
import { QUEST_ASC_ABI } from "../../src/attestcoin/questAscAbi"

export const CC_EXPLORER = "https://creditcoin-testnet.blockscout.com"
export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io"

export function log(step: string, detail?: unknown) {
  const stamp = new Date().toISOString().slice(11, 19)
  console.log(`[${stamp}] ${step}${detail !== undefined ? ` ${detail}` : ""}`)
}

const PROOF_RETRIES = 8
const PROOF_RETRY_DELAY_MS = 20_000

async function fetchProofWithRetry(sepolia: JsonRpcProvider, txHash: string) {
  let last = await fetchProof(SEPOLIA_CHAIN_KEY, txHash, sepolia)
  for (let attempt = 1; attempt <= PROOF_RETRIES && !last.ok; attempt++) {
    log("   proof not ready", `attempt ${attempt}, retrying in ${PROOF_RETRY_DELAY_MS / 1000}s`)
    await new Promise((resolve) => setTimeout(resolve, PROOF_RETRY_DELAY_MS))
    last = await fetchProof(SEPOLIA_CHAIN_KEY, txHash, sepolia)
  }
  return last
}

export interface PipelineResult {
  proof: SourceTxProof
  txHash: string
  blockNumber: number
  gasUsed: bigint
  gasLimit: bigint
  attestationWaitMs: number
  attestationPolls: number
  proofSource: SourceTxProof["source"]
}

/**
 * Take one already-mined Sepolia transaction all the way to a verified completion on Creditcoin.
 */
export async function runPipeline(
  cc: JsonRpcProvider,
  sepolia: JsonRpcProvider,
  wallet: Wallet,
  questAscAddress: string,
  sourceTxHash: string,
  sourceBlock: bigint,
  questIdHint: bigint
): Promise<PipelineResult> {
  const questASC = new Contract(questAscAddress, QUEST_ASC_ABI, wallet)

  log("   waiting for attestation")
  // Strictly above the block: a continuity proof needs endpoints on both sides of it.
  const waited = await waitUntilProvable(cc, SEPOLIA_CHAIN_KEY, sourceBlock, {
    onPoll: ({ attestedHeight, elapsedMs }) => {
      const behind = sourceBlock - attestedHeight
      log(
        "     frontier",
        `${attestedHeight}, ${behind > 0n ? `${behind} behind` : "covered"}, ` +
          `${Math.round(elapsedMs / 1000)}s`
      )
    },
  })
  if (!waited.ok) throw new Error(waited.error)
  log("   attested", `after ${Math.round(waited.value.waitedMs / 1000)}s, ${waited.value.polls} polls`)

  // Fetched here, immediately before submitting, because proof material perishes.
  // Both providers can still answer "no upper continuity bound" for a few seconds after the
  // frontier moves, so this retries rather than failing a nine-minute run on a race.
  const proof = await fetchProofWithRetry(sepolia, sourceTxHash)
  if (!proof.ok) throw new Error(proof.error)
  log("   proof", `${proof.value.source}, ${proof.value.continuityProof.roots.length} continuity roots, ${proof.value.merkleProof.siblings.length} siblings`)

  const localRoot = await verifyMerkleRootLocally(proof.value)
  if (!localRoot.ok) throw new Error(localRoot.error)
  log("   merkle", "re-derived locally and matches")

  const pre = await preflight(questASC, proof.value, questIdHint)
  if (!pre.ok) throw new Error(`preflight failed: ${pre.error}`)
  log("   preflight", `would handle ${pre.value} log(s), no gas spent`)

  const submitted = await submitProof(wallet, questAscAddress, proof.value, questIdHint)
  if (!submitted.ok) {
    throw new Error(`submit failed (${submitted.failure?.kind}): ${submitted.error}`)
  }
  log("   submitted", `${CC_EXPLORER}/tx/${submitted.value.txHash}`)
  log("   gas", `${submitted.value.gasUsed} / ${submitted.value.gasLimit}`)

  return {
    proof: proof.value,
    txHash: submitted.value.txHash,
    blockNumber: submitted.value.blockNumber,
    gasUsed: submitted.value.gasUsed,
    gasLimit: submitted.value.gasLimit,
    attestationWaitMs: waited.value.waitedMs,
    attestationPolls: waited.value.polls,
    proofSource: proof.value.source,
  }
}

/**
 * Persist the exact bytes and proof material a run produced, so a forge test can replay the real
 * transaction through the real adapter without touching the network again.
 */
export function fixtureFor(name: string, proof: SourceTxProof, extra: Record<string, unknown>) {
  return {
    name,
    capturedAt: new Date().toISOString(),
    chainKey: proof.chainKey,
    blockHeight: proof.blockHeight,
    txIndex: proof.txIndex,
    txHash: proof.txHash,
    encodedTransaction: proof.encodedTransaction,
    merkleProof: proof.merkleProof,
    continuityProof: proof.continuityProof,
    ...extra,
  }
}

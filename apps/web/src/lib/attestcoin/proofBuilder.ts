import { SourceTxProof } from "./types"

/**
 * Browser client for the Attestcoin Proof Builder REST API.
 *
 * The self-claim path deliberately does not go through the Vael API. A player must be able to
 * complete a quest with nothing but their wallet, this page, and the public protocol services, so
 * that the platform keeps working when our servers do not. This talks straight to the prover.
 *
 * Proof material perishes: attestations advance and the continuity chain a proof needs grows. The
 * proof is therefore fetched at the moment of claiming, never cached.
 */
const DEFAULT_URL = "https://prover.cc3-testnet.creditcoin.network"
const REQUEST_TIMEOUT_MS = 30_000

export function proofBuilderUrl(): string {
  return process.env.NEXT_PUBLIC_PROOF_BUILDER_URL || DEFAULT_URL
}

export class ProofNotReadyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProofNotReadyError"
  }
}

interface RawProofResponse {
  chainKey: number
  headerNumber: number
  txIndex: number
  txHash: string
  txBytes: string
  merkleProof: { root: string; siblings: { hash: string; isLeft: boolean }[] }
  continuityProof: { lowerEndpointDigest: string; roots: string[] }
}

/**
 * Fetch a proof for one source transaction.
 *
 * A 422 means the attestors have not bracketed the block yet, which is an ordinary "not ready"
 * rather than a failure, so it is raised as its own error type for the UI to word properly.
 */
export async function fetchProof(chainKey: number, txHash: string): Promise<SourceTxProof> {
  const url = `${proofBuilderUrl()}/api/v1/proof-by-tx/${chainKey}/${txHash}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })

    if (response.status === 422 || response.status === 404) {
      throw new ProofNotReadyError(
        "The Attestcoin attestors have not covered this block yet. This usually takes about eight minutes."
      )
    }
    if (!response.ok) {
      throw new Error(`Proof Builder returned ${response.status} ${response.statusText}`)
    }

    const body = (await response.json()) as RawProofResponse | { data: RawProofResponse }
    const raw = "data" in body ? body.data : body
    return normalise(raw)
  } catch (error) {
    if (error instanceof ProofNotReadyError) throw error
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The Proof Builder did not respond within 30 seconds.")
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function normalise(raw: RawProofResponse): SourceTxProof {
  return {
    chainKey: Number(raw.chainKey),
    blockHeight: Number(raw.headerNumber),
    txIndex: Number(raw.txIndex),
    txHash: raw.txHash,
    encodedTransaction: raw.txBytes as `0x${string}`,
    merkleProof: {
      root: raw.merkleProof.root as `0x${string}`,
      siblings: raw.merkleProof.siblings.map((s) => ({
        hash: s.hash as `0x${string}`,
        isLeft: Boolean(s.isLeft),
      })),
    },
    continuityProof: {
      lowerEndpointDigest: raw.continuityProof.lowerEndpointDigest as `0x${string}`,
      roots: raw.continuityProof.roots.map((r) => r as `0x${string}`),
    },
  }
}

/** The tuple shape QuestASC.submit expects. */
export function toSubmitArgs(proof: SourceTxProof) {
  return {
    chainKey: BigInt(proof.chainKey),
    blockHeight: BigInt(proof.blockHeight),
    encodedTransaction: proof.encodedTransaction,
    merkleProof: {
      root: proof.merkleProof.root,
      siblings: proof.merkleProof.siblings.map((s) => ({ hash: s.hash, isLeft: s.isLeft })),
    },
    continuityProof: {
      lowerEndpointDigest: proof.continuityProof.lowerEndpointDigest,
      roots: proof.continuityProof.roots,
    },
  } as const
}

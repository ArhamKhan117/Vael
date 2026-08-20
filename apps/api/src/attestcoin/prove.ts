import { proofProvider } from "@gluwa/usc-sdk"
import { JsonRpcProvider } from "ethers"

import { env } from "../config/env"
import { PROOF_BUILDER_TIMEOUT_MS, Result, err, ok } from "./config"
import { recordProofBuilderCall } from "../lib/observability"

/**
 * Proof material for one source transaction, in the shape QuestASC.submit expects.
 */
export interface SourceTxProof {
  chainKey: number
  blockHeight: number
  txIndex: number
  txHash: string
  encodedTransaction: string
  merkleProof: { root: string; siblings: { hash: string; isLeft: boolean }[] }
  continuityProof: { lowerEndpointDigest: string; roots: string[] }
  /** Which source produced it, for the audit trail. */
  source: "proof-builder" | "raw"
  fetchedAt: Date
}

/**
 * Fetch a proof for one transaction.
 *
 * **Fetch this immediately before submitting.** Proof material perishes: attestations land every
 * 10 source blocks and checkpoints every 100, so the continuity chain a proof needs grows over
 * time. A proof that carried one continuity root when fetched needed 31 when retried later. There
 * is deliberately no caching here.
 *
 * The hosted Proof Builder is the primary source. `RawProofBuilder` over a Sepolia RPC is an
 * independent second source, used when the hosted service fails, so an outage there does not stop
 * the worker.
 */
export async function fetchProof(
  chainKey: number,
  txHash: string,
  sepolia: JsonRpcProvider
): Promise<Result<SourceTxProof>> {
  const startedAt = Date.now()
  const hosted = await fetchFromProofBuilder(chainKey, txHash)
  recordProofBuilderCall(hosted.ok, Date.now() - startedAt)
  if (hosted.ok) return hosted

  const fallback = await fetchFromRawBuilder(chainKey, txHash, sepolia)
  if (fallback.ok) return fallback

  return err(`both proof sources failed. hosted: ${hosted.error}; raw: ${fallback.error}`)
}

async function fetchFromProofBuilder(
  chainKey: number,
  txHash: string
): Promise<Result<SourceTxProof>> {
  try {
    const builder = new proofProvider.service.ProofBuilder(
      chainKey,
      env.PROOF_BUILDER_URL,
      PROOF_BUILDER_TIMEOUT_MS
    )
    const result = await builder.getProof(txHash)
    if (!result.success || !result.data) {
      return err(result.error ?? "proof builder returned no data")
    }
    return ok(toSourceTxProof(result.data, "proof-builder"))
  } catch (error: any) {
    return err(`proof builder threw: ${error?.message ?? String(error)}`)
  }
}

async function fetchFromRawBuilder(
  chainKey: number,
  txHash: string,
  sepolia: JsonRpcProvider
): Promise<Result<SourceTxProof>> {
  try {
    const { chainInfo, encoding } = await import("@gluwa/usc-sdk")
    const creditcoin = new JsonRpcProvider(env.CREDITCOIN_RPC_URL, undefined, {
      batchMaxCount: 1,
      staticNetwork: true,
    })
    const blockProvider = new proofProvider.raw.blockProvider.SimpleBlockProvider(sepolia)
    const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(creditcoin)
    const builder = new proofProvider.raw.RawProofBuilder(
      chainKey,
      blockProvider,
      chainInfoProvider,
      encoding.EncodingVersion.V1
    )
    const result = await builder.getProof(txHash)
    if (!result.success || !result.data) {
      return err(result.error ?? "raw proof builder returned no data")
    }
    return ok(toSourceTxProof(result.data, "raw"))
  } catch (error: any) {
    return err(`raw proof builder threw: ${error?.message ?? String(error)}`)
  }
}

function toSourceTxProof(data: any, source: SourceTxProof["source"]): SourceTxProof {
  return {
    chainKey: Number(data.chainKey),
    blockHeight: Number(data.headerNumber),
    txIndex: Number(data.txIndex),
    txHash: data.txHash,
    encodedTransaction: data.txBytes,
    merkleProof: {
      root: data.merkleProof.root,
      siblings: data.merkleProof.siblings.map((s: any) => ({
        hash: s.hash,
        isLeft: Boolean(s.isLeft),
      })),
    },
    continuityProof: {
      lowerEndpointDigest: data.continuityProof.lowerEndpointDigest,
      roots: [...data.continuityProof.roots],
    },
    source,
    fetchedAt: new Date(),
  }
}

/**
 * Re-derive the Merkle root from the transaction and its sibling path, and check it against the
 * root the provider handed us.
 *
 * The tree is domain separated: a leaf is `keccak(0x00 || bytes)` and an inner node is
 * `keccak(0x01 || left || right)`. Both hashes come from the SDK so this check uses the same
 * primitives the chain does, but it recomputes the path independently. If a provider ever returns
 * a root that does not match its own siblings, this catches it before we spend gas finding out.
 */
export async function verifyMerkleRootLocally(proof: SourceTxProof): Promise<Result<string>> {
  try {
    const { proofProvider: pp } = await import("@gluwa/usc-sdk")
    const { hashLeaf, hashInner } = pp.merkle

    let node = hashLeaf(proof.encodedTransaction)
    for (const sibling of proof.merkleProof.siblings) {
      node = sibling.isLeft ? hashInner(sibling.hash, node) : hashInner(node, sibling.hash)
    }

    if (node.toLowerCase() !== proof.merkleProof.root.toLowerCase()) {
      return err(
        `local Merkle root ${node} does not match the provider's root ${proof.merkleProof.root}`
      )
    }
    return ok(node)
  } catch (error: any) {
    return err(`local Merkle re-derivation failed: ${error?.message ?? String(error)}`)
  }
}

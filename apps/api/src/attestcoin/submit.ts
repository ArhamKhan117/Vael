import { Contract, TransactionReceipt, Wallet } from "ethers"

import {
  Result,
  SUBMIT_GAS_FLOOR,
  SUBMIT_GAS_MULTIPLIER_DENOMINATOR,
  SUBMIT_GAS_MULTIPLIER_NUMERATOR,
  err,
  ok,
} from "./config"
import { SourceTxProof } from "./prove"
import { QUEST_ASC_ABI } from "./questAscAbi"
import { recordSubmitProof } from "../lib/observability"

/**
 * How a failed submission should be treated.
 *
 * `refetch` means the proof material perished between fetching and submitting, which is routine:
 * attestations advance and the continuity chain a proof needs grows. The fix is to fetch a fresh
 * proof and try again, not to give up.
 *
 * `fatal` means the submission is wrong in a way that retrying cannot fix: a replayed log, a rule
 * the action does not satisfy, an emitter that is not registered.
 */
export type FailureKind = "refetch" | "fatal"

export interface SubmitFailure {
  kind: FailureKind
  reason: string
}

export interface SubmitSuccess {
  txHash: string
  blockNumber: number
  gasUsed: bigint
  gasLimit: bigint
  handledLogs: bigint
  receipt: TransactionReceipt
}

/** Revert strings that mean the proof aged out rather than that it was wrong. */
const PERISHED_PATTERNS = [
  "proofrejected",
  "merkle root mismatch",
  "continuity proof does not match attestation",
  "continuity",
  "merkle proof validation failed",
]

export function classifyRevert(message: string): SubmitFailure {
  const lower = message.toLowerCase()
  if (PERISHED_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return { kind: "refetch", reason: message }
  }
  return { kind: "fatal", reason: message }
}

/**
 * Turn an ethers CALL_EXCEPTION into something a human and `classifyRevert` can both read.
 *
 * `error.revert` is populated only when the contract's custom errors are declared in the ABI,
 * which is why QUEST_ASC_ABI declares all of them. Without that, every on-chain rejection reads as
 * "unknown custom error" and a replay is indistinguishable from a broken rule.
 */
export function describeRevert(error: any): string {
  if (error?.revert?.name) {
    const args = (error.revert.args ?? []).map((a: unknown) => String(a)).join(", ")
    return `${error.revert.name}(${args})`
  }
  return error?.shortMessage ?? error?.reason ?? error?.message ?? String(error)
}

function toSourceTxTuple(proof: SourceTxProof) {
  return {
    chainKey: proof.chainKey,
    blockHeight: proof.blockHeight,
    encodedTransaction: proof.encodedTransaction,
    merkleProof: {
      root: proof.merkleProof.root,
      siblings: proof.merkleProof.siblings.map((s) => ({ hash: s.hash, isLeft: s.isLeft })),
    },
    continuityProof: {
      lowerEndpointDigest: proof.continuityProof.lowerEndpointDigest,
      roots: proof.continuityProof.roots,
    },
  }
}

/**
 * Keyless preflight. Costs nothing and cannot change state.
 *
 * This is what catches a replayed log or a broken rule before any gas is spent, and it is the same
 * code path the submission itself takes.
 */
export async function preflight(
  questASC: Contract,
  proof: SourceTxProof,
  questIdHint: bigint
): Promise<Result<bigint>> {
  try {
    const handled: bigint = await questASC
      .getFunction("submit")
      .staticCall(toSourceTxTuple(proof), questIdHint)
    return ok(handled)
  } catch (error: any) {
    return err(describeRevert(error))
  }
}

/**
 * Submit one proof.
 *
 * Gas is set explicitly at estimate x 1.5 with a 400,000 floor, because estimates come from warm
 * simulations and underestimate cold writes. `gasUsed` is compared to `gasLimit` afterwards: on
 * this chain an exhausted limit looks exactly like a revert, so a receipt that consumed its whole
 * limit is treated as a failure even though its status may say success.
 */
export async function submitProof(
  wallet: Wallet,
  questAscAddress: string,
  proof: SourceTxProof,
  questIdHint: bigint
): Promise<Result<SubmitSuccess> & { failure?: SubmitFailure }> {
  const questASC = new Contract(questAscAddress, QUEST_ASC_ABI, wallet)

  const pre = await preflight(questASC, proof, questIdHint)
  if (!pre.ok) {
    recordSubmitProof(false)
    return { ...err(pre.error), failure: classifyRevert(pre.error) }
  }

  let gasLimit: bigint
  try {
    const estimate = await questASC
      .getFunction("submit")
      .estimateGas(toSourceTxTuple(proof), questIdHint)
    const scaled =
      (estimate * SUBMIT_GAS_MULTIPLIER_NUMERATOR) / SUBMIT_GAS_MULTIPLIER_DENOMINATOR
    gasLimit = scaled > SUBMIT_GAS_FLOOR ? scaled : SUBMIT_GAS_FLOOR
  } catch {
    // Estimation failing after a clean preflight usually means the node refused to simulate, not
    // that the call is bad. Fall back to the floor rather than abandoning the submission.
    gasLimit = SUBMIT_GAS_FLOOR
  }

  try {
    const tx = await questASC
      .getFunction("submit")
      .send(toSourceTxTuple(proof), questIdHint, { gasLimit })
    const receipt = await tx.wait(1)
    if (!receipt) {
      recordSubmitProof(false)
      return { ...err("no receipt returned"), failure: { kind: "refetch", reason: "no receipt" } }
    }

    if (receipt.status !== 1) {
      recordSubmitProof(false)
      return {
        ...err(`submission reverted in block ${receipt.blockNumber}`),
        failure: { kind: "fatal", reason: "reverted on chain" },
      }
    }

    // An exhausted gas limit is indistinguishable from a revert here.
    if (receipt.gasUsed >= gasLimit) {
      recordSubmitProof(false)
      return {
        ...err(`submission consumed its entire gas limit (${receipt.gasUsed}/${gasLimit})`),
        failure: { kind: "refetch", reason: "out of gas" },
      }
    }

    const handled = countHandledLogs(receipt, questAscAddress)
    recordSubmitProof(true)
    return ok({
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      gasLimit,
      handledLogs: handled,
      receipt,
    })
  } catch (error: any) {
    const message = describeRevert(error)
    recordSubmitProof(false)
    return { ...err(message), failure: classifyRevert(message) }
  }
}

/** Count QuestProofApplied events emitted by QuestASC in this receipt. */
function countHandledLogs(receipt: TransactionReceipt, questAscAddress: string): bigint {
  const iface = new Contract(questAscAddress, QUEST_ASC_ABI).interface
  let count = 0n
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== questAscAddress.toLowerCase()) continue
    try {
      if (iface.parseLog({ topics: [...log.topics], data: log.data })?.name === "QuestProofApplied") {
        count += 1n
      }
    } catch {
      // Not one of ours, or an event this ABI slice does not declare.
    }
  }
  return count
}

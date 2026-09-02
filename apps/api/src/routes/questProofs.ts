import { Router } from "express"
import { z } from "zod"

import { getQuestById, getParticipantProgress } from "../services/questService"
import { SEPOLIA_CHAIN_KEY, creditcoinProvider } from "../attestcoin/config"
import { getAttestedFrontier } from "../attestcoin/chainInfo"
import { createWorkerStore } from "../attestcoin/store"

export const questProofsRouter: Router = Router()

const submitProofSchema = z.object({
  /** Source-chain transaction hash, currently always Ethereum Sepolia. */
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  participant: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
})

/**
 * POST /quests/:id/submit-proof
 *
 * Registers a source-chain transaction for proving. It records intent only: this endpoint
 * does not verify anything and cannot complete a quest. Completion happens on Creditcoin
 * when QuestASC verifies an Attestcoin proof through the block prover precompile, either
 * from the worker or from the player's own wallet.
 *
 * The proof pipeline that advances a row past `detected` arrives in milestone 3.
 */
questProofsRouter.post("/:id/submit-proof", async (req, res, next) => {
  try {
    const questId = Number(req.params.id)
    if (Number.isNaN(questId) || questId <= 0) {
      return res.status(400).json({ message: "Invalid quest id" })
    }

    const parsed = submitProofSchema.parse(req.body)

    const quest = await getQuestById(questId)
    if (quest.statusValue !== 1) {
      return res.status(400).json({
        message: `Quest status is ${quest.status}. Only active quests can be completed.`,
      })
    }

    const now = Math.floor(Date.now() / 1000)
    const expiry = Number(quest.expiry ?? "0")
    if (expiry !== 0 && expiry < now) {
      return res.status(400).json({ message: "Quest has expired" })
    }

    const participant = parsed.participant ?? quest.assignedParticipant
    if (participant.toLowerCase() !== quest.assignedParticipant.toLowerCase()) {
      return res.status(403).json({
        message: "Participant address does not match quest assignment",
      })
    }

    // Acceptance and completion are read from Creditcoin, never from the cache.
    const progress = await getParticipantProgress(questId, participant)
    if (!progress.accepted) {
      return res.status(400).json({
        message: "Quest has not been accepted by this participant",
      })
    }
    if (progress.completed) {
      return res.status(400).json({ message: "Quest already marked as completed" })
    }

    // The worker's own queue, not a second table beside it. A submission registered anywhere the
    // worker does not read is a button that appears to work and never does.
    const store = createWorkerStore()
    await store.init()

    const indexed = await store.getQuest(questId)
    const existing = (await store.allSubmissions()).find(
      (row) =>
        row.questIdOnChain === questId &&
        row.sourceTxHash.toLowerCase() === parsed.transactionHash.toLowerCase()
    )
    if (existing) {
      return res.status(409).json({
        message: "This transaction hash has already been submitted for this quest",
      })
    }

    await store.upsertSubmission({
      questIdOnChain: questId,
      participant: participant.toLowerCase(),
      sourceChainKey: indexed?.sourceChainKey ?? SEPOLIA_CHAIN_KEY,
      sourceTxHash: parsed.transactionHash,
      sourceBlock: 0,
      actionType: indexed?.actionType ?? 0,
      status: "detected",
    })

    return res.status(202).json({
      message:
        "Transaction registered. It will be proved on Creditcoin once Attestcoin has attested the source block.",
      questId: questId.toString(),
      participant,
      sourceTransactionHash: parsed.transactionHash,
      status: "detected",
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/:id/proof-status?participant=0x…
 *
 * Where a submission has got to, for the quest page's timeline.
 *
 * This is a convenience. The self-claim path in the browser talks to the Proof Builder and to
 * QuestASC directly, so a player can still complete a quest when this endpoint is unavailable;
 * the timeline just goes quiet.
 */
questProofsRouter.get("/:id/proof-status", async (req, res, next) => {
  try {
    const questId = Number(req.params.id)
    if (Number.isNaN(questId) || questId <= 0) {
      return res.status(400).json({ message: "Invalid quest id" })
    }
    const participant = String(req.query.participant ?? "")
    if (!/^0x[a-fA-F0-9]{40}$/.test(participant)) {
      return res.status(400).json({ message: "participant must be an address" })
    }

    const store = createWorkerStore()
    await store.init()

    // The worker keys a submission by chain, source transaction, and quest, so without a known
    // transaction the newest row for this quest is the right answer.
    const rows = (await store.allSubmissions()).filter(
      (row) =>
        row.questIdOnChain === questId &&
        row.participant.toLowerCase() === participant.toLowerCase()
    )
    const latest = rows[rows.length - 1]

    let attestedHeight: number | undefined
    const frontier = await getAttestedFrontier(creditcoinProvider(), SEPOLIA_CHAIN_KEY)
    if (frontier.ok) attestedHeight = Number(frontier.value.height)

    if (!latest) {
      // No submission yet. The index still knows whether the quest was completed, which happens
      // whenever someone claimed it themselves rather than leaving it to the worker.
      const indexed = await store.getQuest(questId)
      const stage = indexed?.completed ? "verified" : "not_started"
      return res.json({ stage, ...(attestedHeight ? { attestedHeight } : {}) })
    }

    return res.json({
      stage: latest.status,
      sourceTxHash: latest.sourceTxHash,
      sourceBlock: latest.sourceBlock,
      creditcoinTxHash: latest.creditcoinTxHash,
      error: latest.error,
      ...(attestedHeight ? { attestedHeight } : {}),
    })
  } catch (error) {
    next(error)
  }
})

import { Router } from "express"
import { z } from "zod"

import { getQuestById, getParticipantProgress } from "../services/questService"
import {
  getQuestByOnChainId,
  isTransactionHashSubmitted,
  saveQuestSubmission,
} from "../services/dbService"

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

    const alreadySubmitted = await isTransactionHashSubmitted(questId, parsed.transactionHash)
    if (alreadySubmitted) {
      return res.status(409).json({
        message: "This transaction hash has already been submitted for this quest",
      })
    }

    const dbQuest = await getQuestByOnChainId(questId)
    await saveQuestSubmission({
      quest_id_on_chain: questId,
      participant_address: participant,
      transaction_hash: parsed.transactionHash,
      source_chain_key: dbQuest?.source_chain_key ?? 1,
      verification_status: "detected",
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

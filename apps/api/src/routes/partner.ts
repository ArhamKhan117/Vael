import { Router } from "express"
import { Contract } from "ethers"
import { z } from "zod"

import { creditcoinProvider } from "../attestcoin/config"
import { createWorkerStore } from "../attestcoin/store"
import {
  QuestTemplate,
  campaignIdToUint,
  createCampaignQuests,
  readQuest,
} from "../services/campaignQuests"

export const partnerRouter: Router = Router()

const ESCROW_ABI = [
  "function campaignBalance(bytes32 campaignId) view returns (uint256)",
  "function getFeeAndPoolAmount(uint256 depositAmount) view returns (uint256 feeAmount, uint256 poolAmount)",
]

const templateSchema = z.object({
  actionType: z.number().int().min(0).max(4),
  emitter: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default("0x0000000000000000000000000000000000000000"),
  minAmount: z.string().regex(/^\d+$/),
  rewardPerParticipant: z.string().regex(/^\d+$/),
  badgeLevel: z.number().int().min(1).max(10).default(1),
  playerMustMatch: z.boolean().default(true),
  category: z.number().int().min(0).max(4).default(0),
  metadataURI: z.string().min(1),
  sourceChainKey: z.number().int().positive().default(1),
})

const publishSchema = z.object({
  campaignId: z.string().min(1),
  participant: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  templates: z.array(templateSchema).min(1).max(10),
})

function escrowAddress(): string | undefined {
  const value = process.env.CAMPAIGN_ESCROW_ADDRESS
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? value : undefined
}

/**
 * POST /partner/publish
 *
 * Turn a funded campaign into quests on chain.
 *
 * The escrow balance is checked first and the whole call is refused if the pool cannot cover what
 * the templates promise. A campaign whose quests exist but whose escrow is empty looks live and
 * fails at the one moment that matters, when a player has already done the work.
 */
partnerRouter.post("/publish", async (req, res, next) => {
  try {
    const parsed = publishSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues })
    }
    const { campaignId, participant, templates } = parsed.data

    const escrow = escrowAddress()
    if (!escrow) return res.status(503).json({ message: "CampaignEscrow is not configured" })

    const contract = new Contract(escrow, ESCROW_ABI, creditcoinProvider())
    const key = `0x${campaignIdToUint(campaignId).toString(16).padStart(64, "0")}`
    const balance: bigint = await contract.getFunction("campaignBalance").staticCall(key)

    const promised = templates.reduce((sum, t) => sum + BigInt(t.rewardPerParticipant), 0n)
    if (balance < promised) {
      return res.status(400).json({
        message: "The escrow pool does not cover what these quests promise",
        poolBalance: balance.toString(),
        promised: promised.toString(),
      })
    }

    const created = await createCampaignQuests(campaignId, participant, templates as QuestTemplate[])
    const readBack = await Promise.all(created.map((quest) => readQuest(quest.questId)))

    return res.json({
      campaignId,
      onChainCampaignId: campaignIdToUint(campaignId).toString(),
      escrowKey: key,
      poolBalance: balance.toString(),
      created,
      quests: readBack,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /partner/campaign/:campaignId
 *
 * Everything a partner needs to see about their campaign: the pool the chain holds, every quest
 * created for it, and the proof state of each from the index and the worker's own queue.
 */
partnerRouter.get("/campaign/:campaignId", async (req, res, next) => {
  try {
    const campaignId = String(req.params.campaignId)
    const escrow = escrowAddress()
    if (!escrow) return res.status(503).json({ message: "CampaignEscrow is not configured" })

    const onChain = campaignIdToUint(campaignId)
    const key = `0x${onChain.toString(16).padStart(64, "0")}`
    const contract = new Contract(escrow, ESCROW_ABI, creditcoinProvider())
    const balance: bigint = await contract.getFunction("campaignBalance").staticCall(key)

    const store = createWorkerStore()
    await store.init()

    // The index knows which quests exist; the chain is asked for the ones that claim this campaign,
    // because a quest's campaign id is not in any event.
    const indexed = await store.allQuests()
    const [submissions, actions] = await Promise.all([store.allSubmissions(), store.actions()])

    const quests = []
    for (const quest of indexed) {
      const detail = await readQuest(quest.questId).catch(() => null)
      if (!detail || detail.campaignId !== onChain.toString()) continue

      const submission = submissions
        .filter((s) => s.questIdOnChain === quest.questId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      const proved = actions.find((a) => a.questId === quest.questId)

      quests.push({
        ...detail,
        accepted: quest.accepted,
        completed: quest.completed,
        actionType: quest.actionType,
        minAmount: quest.minAmount,
        proof: proved
          ? {
              state: "verified" as const,
              replayKey: proved.replayKey,
              sourceBlock: proved.sourceBlock,
              creditcoinBlock: proved.creditcoinBlock,
              at: proved.createdAt,
            }
          : submission
            ? {
                state: submission.status,
                sourceTxHash: submission.sourceTxHash,
                attempts: submission.attempts,
                error: submission.error ?? null,
                at: submission.updatedAt,
              }
            : { state: "waiting" as const },
      })
    }

    return res.json({
      campaignId,
      onChainCampaignId: onChain.toString(),
      escrowKey: key,
      poolBalance: balance.toString(),
      quests,
    })
  } catch (error) {
    next(error)
  }
})

const retrySchema = z.object({ submissionId: z.string().min(1) })

/**
 * POST /partner/retry
 *
 * Put a failed submission back in the worker's queue.
 *
 * Retrying is safe by construction rather than by care: the replay key is burned on chain, so a
 * submission that already landed cannot land twice however many times it is retried.
 */
partnerRouter.post("/retry", async (req, res, next) => {
  try {
    const parsed = retrySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues })
    }
    const store = createWorkerStore()
    await store.init()

    const submission = await store.getSubmission(parsed.data.submissionId)
    if (!submission) return res.status(404).json({ message: "no such submission" })
    if (submission.status === "verified") {
      return res.status(400).json({ message: "that submission already verified" })
    }

    const updated = await store.updateSubmission(submission.id, {
      status: "detected",
      attempts: 0,
      ...(submission.error ? { error: "" } : {}),
    })
    return res.json({ submission: updated })
  } catch (error) {
    next(error)
  }
})

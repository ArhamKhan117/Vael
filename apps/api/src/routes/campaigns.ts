import { Router } from "express"
import { z } from "zod"

import {
  createCampaign,
  createCampaignDraft,
  deleteCampaign,
  getCampaignById,
  listCampaigns,
  updateCampaign,
  updateCampaignStatus,
} from "../services/dbService"
import { joinCampaign, activateCampaign } from "../services/campaignService"
import { getCampaignBalance, refundToPartnerRaw } from "../services/campaignEscrowService"

export const campaignsRouter: Router = Router()

const createCampaignSchema = z.object({
  partner_wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  partner_name: z.union([z.string().max(100), z.literal("")]).optional(),
  title: z.string().min(2),
  template_type: z.enum(["swap", "deposit", "borrow", "stake", "other"]),
  description: z.string().optional(),
  thumbnail: z.union([z.string().url(), z.string().regex(/^data:image\/[a-zA-Z+]+;base64,.+/), z.literal("")]).optional(),
  template_params: z.record(z.string(), z.unknown()),
  pool_amount: z.number().positive(),
  max_participants: z.number().int().positive(),
  period_start: z.string().datetime().optional(),
  period_end: z.string().datetime().optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
})

const createDraftSchema = z.object({
  partner_wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  partner_name: z.union([z.string().max(100), z.literal("")]).optional(),
  title: z.string().min(2),
  template_type: z.enum(["swap", "deposit", "borrow", "stake", "other"]).optional(),
  template_params: z.record(z.string(), z.unknown()).optional(),
  pool_amount: z.number().min(0).optional(),
  max_participants: z.number().int().positive().optional(),
  pool_token: z.string().optional(),
  description: z.string().optional(),
  thumbnail: z.union([z.string().url(), z.string().regex(/^data:image\/[a-zA-Z+]+;base64,.+/), z.literal("")]).optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
})

const joinCampaignSchema = z.object({
  participant: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
})

const refundSchema = z.object({
  partner_wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
})

/**
 * POST /campaigns/draft
 * Create a draft campaign (partial data)
 */
campaignsRouter.post("/draft", async (req, res, next) => {
  try {
    const parsed = createDraftSchema.parse(req.body)
    const tp = (parsed.template_params ?? {}) as Record<string, unknown>
    const protocolAddr = tp?.protocol_address
    if (protocolAddr && !/^0x[a-fA-F0-9]{40}$/.test(String(protocolAddr))) {
      return res.status(400).json({ message: "template_params.protocol_address must be valid 0x address" })
    }
    const startAt = parsed.period_start ?? parsed.start_at
    const endAt = parsed.period_end ?? parsed.end_at
    const campaign = await createCampaignDraft({
      partner_wallet: parsed.partner_wallet,
      ...(parsed.partner_name != null && { partner_name: parsed.partner_name }),
      title: parsed.title,
      ...(parsed.template_type != null && { template_type: parsed.template_type }),
      ...(parsed.template_params != null && { template_params: parsed.template_params as Record<string, unknown> }),
      ...(parsed.pool_amount != null && { pool_amount: parsed.pool_amount }),
      ...(parsed.max_participants != null && { max_participants: parsed.max_participants }),
      ...(parsed.pool_token != null && { pool_token: parsed.pool_token }),
      ...(parsed.description != null && { description: parsed.description }),
      ...(parsed.thumbnail && { thumbnail: parsed.thumbnail }),
      ...(startAt && { start_at: startAt }),
      ...(endAt && { end_at: endAt }),
    })
    return res.status(201).json(campaign)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.issues })
    }
    next(error)
  }
})

/**
 * POST /campaigns
 * Create a new campaign (partner)
 */
campaignsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createCampaignSchema.parse(req.body)
    const tp = parsed.template_params as Record<string, unknown>
    if (!tp?.protocol_address || !/^0x[a-fA-F0-9]{40}$/.test(String(tp.protocol_address))) {
      return res.status(400).json({ message: "template_params must include valid protocol_address" })
    }
    const startAt = parsed.period_start ?? parsed.start_at
    const endAt = parsed.period_end ?? parsed.end_at
    const campaign = await createCampaign({
      partner_wallet: parsed.partner_wallet,
      ...(parsed.partner_name && parsed.partner_name.trim() && { partner_name: parsed.partner_name.trim() }),
      title: parsed.title,
      template_type: parsed.template_type,
      template_params: parsed.template_params as Record<string, unknown>,
      pool_amount: parsed.pool_amount,
      max_participants: parsed.max_participants,
      ...(parsed.description != null && { description: parsed.description }),
      ...(parsed.thumbnail && { thumbnail: parsed.thumbnail }),
      ...(startAt && { start_at: startAt }),
      ...(endAt && { end_at: endAt }),
    })
    return res.status(201).json(campaign)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.issues })
    }
    next(error)
  }
})

/**
 * GET /campaigns
 * List campaigns. Query: ?status=active&partner=0x...
 */
campaignsRouter.get("/", async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined
    const partner = req.query.partner as string | undefined
    const participant = req.query.participant as string | undefined
    const joinedOnly = req.query.joinedOnly === "true"
    const limit = req.query.limit ? Number(req.query.limit) : 50

    const campaigns = await listCampaigns({
      ...(status && { status }),
      ...(partner && { partner_wallet: partner }),
      ...(participant != null && { participant }),
      ...(joinedOnly && { joinedOnly }),
      limit,
    })
    return res.json({ campaigns })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /campaigns/:id
 * Get campaign by ID
 */
campaignsRouter.get("/:id", async (req, res, next) => {
  try {
    const campaign = await getCampaignById(req.params.id)
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" })
    }
    return res.json(campaign)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /campaigns/:id/join
 * User joins campaign → AI generates quest, assigns to participant
 */
campaignsRouter.post("/:id/join", async (req, res, next) => {
  try {
    const parsed = joinCampaignSchema.parse(req.body)
    const result = await joinCampaign(req.params.id, parsed.participant)
    return res.json({
      message: "Campaign joined. Quest created.",
      questIdOnChain: result.questIdOnChain,
      deploymentTxHash: result.deploymentTxHash,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.issues })
    }
    next(error)
  }
})

/**
 * POST /campaigns/:id/refund
 * Partner withdraws excess pool. Refundable = balance - (participant_count - claimed_count) * reward_per_quest_usdc
 */
campaignsRouter.post("/:id/refund", async (req, res, next) => {
  try {
    const parsed = refundSchema.parse(req.body)
    const campaign = await getCampaignById(req.params.id)
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" })
    }
    if (parsed.partner_wallet.toLowerCase() !== campaign.partner_wallet?.toLowerCase()) {
      return res.status(403).json({ message: "Only campaign partner can request refund" })
    }

    const balance = await getCampaignBalance(campaign.id)
    const participantCount = campaign.participant_count ?? 0
    const claimedCount = campaign.claimed_count ?? 0
    const rewardPerQuest = Number(campaign.reward_per_quest_usdc ?? 0)
    const remainingAllocatedRaw = BigInt(
      Math.floor((participantCount - claimedCount) * rewardPerQuest * 1e6)
    )
    const refundableRaw = balance > remainingAllocatedRaw ? balance - remainingAllocatedRaw : 0n

    if (refundableRaw === 0n) {
      const balanceUsdc = Number(balance) / 1e6
      const remainingUsdc = (participantCount - claimedCount) * rewardPerQuest
      return res.status(400).json({
        message: `No refundable amount. Escrow balance: ${balanceUsdc} USDC, allocated for participants: ${remainingUsdc} USDC. If you deposited but balance is 0, check CAMPAIGN_ESCROW_ADDRESS matches the contract you used.`,
        balance: balanceUsdc,
        remainingAllocated: remainingUsdc,
      })
    }

    const txHash = await refundToPartnerRaw(campaign.id, parsed.partner_wallet, refundableRaw)
    return res.json({
      message: "Refund executed",
      transactionHash: txHash,
      amountUsdc: Number(refundableRaw) / 1e6,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.issues })
    }
    next(error)
  }
})

/**
 * POST /campaigns/:id/activate
 * Activate campaign (e.g. after deposit confirmed). For MVP, allows manual activate.
 */
campaignsRouter.post("/:id/activate", async (req, res, next) => {
  try {
    const escrowTxHash = (req.body as { escrow_tx_hash?: string } | undefined)?.escrow_tx_hash
    await activateCampaign(req.params.id, escrowTxHash)
    return res.json({ message: "Campaign activated" })
  } catch (error) {
    next(error)
  }
})

const updateCampaignStatusSchema = z.object({
  status: z.enum(["draft", "pending", "active", "completed", "cancelled"]),
})

const updateCampaignSchema = z.object({
  status: z.enum(["draft", "pending", "active", "completed", "cancelled"]).optional(),
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  partner_name: z.union([z.string().max(100), z.literal("")]).optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  pool_amount: z.number().min(0).optional(),
  max_participants: z.number().int().positive().optional(),
  pool_token: z.string().optional(),
  thumbnail: z.union([z.string().url(), z.string().regex(/^data:image\/[a-zA-Z+]+;base64,.+/), z.literal("")]).optional(),
  template_type: z.enum(["swap", "deposit", "borrow", "stake", "other"]).optional(),
  template_params: z.record(z.string(), z.unknown()).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "At least one field required" })

/**
 * PATCH /campaigns/:id
 * Update campaign (status, or fields for draft save)
 */
campaignsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = updateCampaignSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues })
    }
    const campaign = await getCampaignById(req.params.id)
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" })
    }
    const body = parsed.data
    if (body.status != null) {
      await updateCampaignStatus(req.params.id, body.status)
    }
    const hasFields = ["title", "description", "partner_name", "start_at", "end_at", "pool_amount", "max_participants", "pool_token", "thumbnail", "template_type", "template_params"].some((k) => k in body && (body as Record<string, unknown>)[k] !== undefined)
    if (hasFields) {
      await updateCampaign(req.params.id, {
        ...(body.title != null && { title: body.title }),
        ...(body.description != null && { description: body.description }),
        ...(body.partner_name !== undefined && { partner_name: body.partner_name?.trim() || null }),
        ...(body.start_at != null && { start_at: body.start_at }),
        ...(body.end_at != null && { end_at: body.end_at }),
        ...(body.pool_amount != null && { pool_amount: body.pool_amount }),
        ...(body.max_participants != null && { max_participants: body.max_participants }),
        ...(body.pool_token != null && { pool_token: body.pool_token }),
        ...(body.thumbnail !== undefined && { thumbnail: body.thumbnail?.trim() || null }),
        ...(body.template_type != null && { template_type: body.template_type }),
        ...(body.template_params != null && { template_params: body.template_params }),
      })
    }
    const updated = await getCampaignById(req.params.id)
    return res.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.issues })
    }
    next(error)
  }
})

/**
 * DELETE /campaigns/:id
 * Permanently delete campaign from DB
 */
campaignsRouter.delete("/:id", async (req, res, next) => {
  try {
    const campaign = await getCampaignById(req.params.id)
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" })
    }
    await deleteCampaign(req.params.id)
    return res.status(204).send()
  } catch (error) {
    next(error)
  }
})

import { ChatGroq } from "@langchain/groq"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { StructuredOutputParser } from "@langchain/core/output_parsers"

import { serviceEnv } from "../config/env"
import { createQuest, getQuestById } from "./questService"
import { uploadQuestMetadata } from "./ipfsService"
import { logAIGeneration, saveQuest } from "./dbService"
import {
  PROTOCOLS,
  SEPOLIA_TOKENS,
  getProtocolByAddress,
  getProtocolRouterAddress,
} from "../lib/protocols"
import type { Campaign } from "./dbService"

const addressRegex = /^0x[a-fA-F0-9]{40}$/

const TOKEN_ID_MAP = Object.entries(SEPOLIA_TOKENS)
  .map(([symbol, address]) => `${symbol}=${address}`)
  .join(", ")

const campaignQuestOutputSchema = z.object({
  title: z.string(),
  goal: z.string().describe("One-line goal matching the quest action, e.g. 'Supply 10 USDC on Aave v3' or 'Swap 10 USDC to WETH on Uniswap v3'"),
  shortSummary: z.string(),
  recommendedCategory: z.enum(["swap", "liquidity", "stake", "lend"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  requirements: z.array(z.string()).min(2).max(5),
  steps: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      })
    )
    .min(3)
    .max(6),
  parameters: z.object({
    actionPlan: z.string(),
    successCriteria: z.string(),
    evidenceHint: z.string(),
  }),
  metadataSnippet: z.string(),
  verificationParams: z
    .object({
      tokenIn: z.string().optional().describe("Token the participant sends. Symbol or address. Swap or supply input. Native ETH is WETH9."),
      tokenOut: z.string().optional().describe("Token the participant receives. Swap output, or the borrowed asset. Native ETH is WETH9."),
      minAmountIn: z.number().optional().describe("Min human units of tokenIn. E.g. 10 = 10 USDC."),
      minAmountOut: z.number().optional().describe("Min human units of tokenOut. For borrow."),
        actionType: z.enum(["swap", "deposit", "borrow", "stake"]).optional(),
    })
    .optional(),
  vaelAmountPerQuest: z.number().int().min(0).optional(),
})

type CampaignQuestDraft = z.infer<typeof campaignQuestOutputSchema>
const parser = StructuredOutputParser.fromZodSchema(campaignQuestOutputSchema)

const campaignQuestPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a DeFi quest designer for Vael, a cross-chain quest game. Players act on Ethereum Sepolia and the Attestcoin Protocol proves that transaction on Creditcoin, where QuestASC verifies it and releases the reward. Your task is to generate ONE concrete, on-chain verifiable quest from partner campaign data. Output ONLY valid JSON - no markdown, no commentary.

## Output Format
Return strictly valid JSON matching the schema. No code blocks, no explanation.

## Available Protocols (Ethereum Sepolia, the source chain)
- Uniswap v3 (0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E): DEX - swaps
- Aave v3 (0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951): Lending - supply, borrow

## Field Rules

**goal** (required): One-line quest objective. Format: "[Action] [amount] [token] [optional: to/on/from] [protocol]". Must use real values from campaign (pool_amount, pool_token, template_type). Never use placeholders (e.g. "Swap ? ? to ?").

**verificationParams** (required for auto-verify): On-chain verification will fail without this.
- tokenIn: Token the participant SENDS. Swap or supply input. Use a symbol or an address. Mapping: ${TOKEN_ID_MAP}. Native ETH is WETH9.
- tokenOut: Token participant RECEIVES. Swap output or borrow asset.
- minAmountIn: Min human units of tokenIn (e.g. 10 = 10 USDC). Use for swap, deposit.
- minAmountOut: ONLY for borrow — min tokenOut received. NEVER use for swap (output depends on market, cannot be predicted).
- actionType: swap | deposit | borrow | stake — must match templateType.
Examples: swap USDC to WETH9: tokenIn=USDC, tokenOut=WETH9, minAmountIn=10 (no minAmountOut). Supply USDC: tokenIn=USDC, minAmountIn=10. Borrow USDC: tokenOut=USDC, minAmountOut=100.

**difficulty**: easy (≤3 steps, low amount) | medium (4–5 steps, moderate) | hard (complex, high amount).

**requirements**: 2–5 actionable prerequisites (wallet, tokens, protocol access). Be specific.

**steps**: 3-6 ordered steps. Each step: clear action + what to verify. End with the Sepolia transaction confirming on Etherscan, then the proof verifying on Creditcoin.

**vaelAmountPerQuest**: VAEL reward. Consider pool size, difficulty, engagement. Range 10-100. Favor generosity.`,
  ],
  [
    "human",
    `## Campaign Data
{campaignContext}

## Context
- Protocol: {protocol}
- Protocol info: {protocolInfo}
- Participant: {participant}

Generate a quest from the campaign above. Every value (goal, verificationParams, amounts) must be derived from the campaign data. No placeholders.

## Schema
{formatInstructions}`,
  ],
])

// Built on first use, so a missing Groq key is a 503 from the AI routes rather than a crash that
// stops the whole API from serving anything.
let groqModel: ChatGroq | undefined
function getGroqModel(): ChatGroq {
  if (!groqModel) groqModel = buildGroqModel()
  return groqModel
}

function buildGroqModel(): ChatGroq {
  return new ChatGroq({
  apiKey: serviceEnv().GROQ_API_KEY,
  model: "openai/gpt-oss-20b",
  temperature: 0.3,
  })
}

const chain = () => campaignQuestPrompt.pipe(getGroqModel()).pipe(parser)

/** Serialize campaign for AI context with a compact, curated subset of fields. */
function buildCampaignContext(campaign: Campaign): string {
  const minimal = {
    title: campaign.title,
    description: campaign.description,
    partnerName: campaign.partner_name,
    templateType: campaign.template_type,
    templateParams: campaign.template_params,
    poolToken: campaign.pool_token,
    poolAmountUsdc: campaign.pool_amount,
    rewardPerQuestUsdc: campaign.reward_per_quest_usdc,
    maxParticipants: campaign.max_participants,
    period: {
      start_at: campaign.start_at,
      end_at: campaign.end_at,
    },
  }

  // Compact JSON (no pretty-print) to keep prompt size small.
  return JSON.stringify(minimal)
}

function buildGoalFromTemplate(
  campaign: Campaign,
  protocolName: string
): string {
  const t = campaign.template_type
  const p = campaign.template_params as Record<string, unknown>
  const amount = p.amount ?? "?"
  const tokenIn = (p.token_in as string) ?? "?"
  const tokenOut = (p.token_out as string) ?? "?"
  const token = (p.token as string) ?? tokenIn

  switch (t) {
    case "swap":
      return `Swap ${amount} ${tokenIn} to ${tokenOut} on ${protocolName}`
    case "deposit":
      return `Deposit ${amount} ${token} on ${protocolName}`
    case "borrow":
      return `Borrow ${amount} ${token} from ${protocolName}`
    case "stake":
      return `Stake ${amount} ${token} on ${protocolName}`
    default:
      return `Complete ${t} action on ${protocolName}`
  }
}

function buildVerificationParamsFromTemplate(campaign: Campaign): Record<string, unknown> | undefined {
  const p = campaign.template_params as Record<string, unknown>
  const amount = typeof p.amount === "number" ? p.amount : parseFloat(String(p.amount ?? 0))
  const tokenIn = String(p.token_in ?? "").toUpperCase()

  const params: Record<string, unknown> = {
    actionType: campaign.template_type === "swap" ? "swap" : "supply",
  }

  if (tokenIn && amount > 0) {
    params.tokenIn = tokenIn
    params.minAmountIn = amount
  }

  return Object.keys(params).length > 0 ? params : undefined
}

const VAEL_FALLBACK = 25

export async function generateQuestFromCampaign(
  campaign: Campaign,
  participant: string
): Promise<{ questId: string; questIdOnChain: number; deploymentTxHash: string }> {
  const protocolAddress = String(
    (campaign.template_params as Record<string, unknown>).protocol_address ?? ""
  )
  if (!protocolAddress || !addressRegex.test(protocolAddress)) {
    throw new Error("Campaign template must include valid protocol_address")
  }

  const protocol = getProtocolByAddress(protocolAddress) ?? {
    name: "Custom Protocol",
    description: `Custom protocol at ${protocolAddress}`,
    evmAddress: protocolAddress,
    category: "swap" as const,
    website: "",
  }

  const protocolAddressToUse = getProtocolRouterAddress(protocolAddress)

  const questDraft = (await chain().invoke({
    campaignContext: buildCampaignContext(campaign),
    protocol: protocol.name,
    protocolInfo: `${protocol.name} - ${protocol.description}`,
    participant,
    formatInstructions: parser.getFormatInstructions(),
  })) as CampaignQuestDraft

  const vaelAmount = questDraft.vaelAmountPerQuest ?? VAEL_FALLBACK
  const verificationParams =
    questDraft.verificationParams ?? buildVerificationParamsFromTemplate(campaign)

  const goal =
    questDraft.goal?.trim() ||
    buildGoalFromTemplate(campaign, protocol.name)

  const metadataPayload = {
    title: questDraft.title,
    summary: questDraft.shortSummary,
    projectName: campaign.title,
    chain: "Creditcoin Testnet",
    goal,
    difficulty: questDraft.difficulty,
    category: questDraft.recommendedCategory,
    requirements: questDraft.requirements,
    steps: questDraft.steps,
    parameters: questDraft.parameters,
    reward: {
      token: "VAEL",
      amount: String(vaelAmount),
      badgeLevel: 1,
    },
    campaignReward: {
      token: campaign.pool_token,
      amount: String(campaign.reward_per_quest_usdc),
    },
    participant,
    metadataSnippet: questDraft.metadataSnippet,
    banner: undefined,
    verificationParams,
  }

  const metadataURI = await uploadQuestMetadata(
    metadataPayload,
    `campaign-quest-${campaign.title.slice(0, 24)}-${Date.now()}`
  )

  const onChainResult = await createQuest({
    category: questDraft.recommendedCategory,
    protocol: protocolAddressToUse,
    metadataURI,
    rewardAmount: String(vaelAmount),
    badgeLevel: 1,
    participant,
    expiry: 0,
    parameters: questDraft.parameters.actionPlan,
  })

  const questIdOnChain = Number(onChainResult.questId)
  const onChainQuest = await getQuestById(questIdOnChain)

  const questData: Parameters<typeof saveQuest>[0] = {
    quest_id_on_chain: questIdOnChain,
    campaign_id: campaign.id,
    title: questDraft.title,
    description: questDraft.shortSummary,
    project_name: campaign.title,
    category: questDraft.recommendedCategory,
    protocol_address: protocolAddressToUse,
    metadata_uri: metadataURI,
    reward_per_participant: String(vaelAmount),
    badge_level: 1,
    assigned_participant: participant,
    status: "active",
    quest_type: "custom",
  }

  if (onChainQuest.agentId) questData.agent_id = Number(onChainQuest.agentId)
  if (onChainQuest.agentController) questData.agent_controller = onChainQuest.agentController

  await saveQuest(questData)

  await logAIGeneration({
    quest_id_on_chain: questIdOnChain,
    prompt_input: { campaign_id: campaign.id, participant },
    ai_output: questDraft,
    metadata_uri: metadataURI,
    deployed_on_chain: true,
    deployment_tx_hash: onChainResult.transactionHash,
  })

  return {
    questId: String(questIdOnChain),
    questIdOnChain,
    deploymentTxHash: onChainResult.transactionHash,
  }
}

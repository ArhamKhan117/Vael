import { ChatGroq } from "@langchain/groq"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { StructuredOutputParser } from "@langchain/core/output_parsers"

import { serviceEnv } from "../config/env"
import { SEPOLIA_TOKENS } from "../lib/protocols"
import { createQuest, getQuestById } from "./questService"
import { uploadQuestMetadata } from "./ipfsService"
import { logAIGeneration, saveQuest } from "./dbService"
import { getProtocolByAddress, getProtocolRouterAddress, PROTOCOLS } from "../lib/protocols"

const addressRegex = /^0x[a-fA-F0-9]{40}$/

const generationInputSchema = z.object({
  projectName: z.string().min(2),
  goal: z.string().min(10),
  chain: z.string().min(2),
  categoryHint: z.enum(["swap", "liquidity", "stake", "lend"]).optional(),
  protocol: z.string().regex(addressRegex),
  participant: z.string().regex(addressRegex),
  rewardAmount: z.string().min(1),
  badgeLevel: z.number().int().positive().max(10),
  expiry: z.number().int().nonnegative().optional(),
  metadataURI: z.string().min(5).max(200).optional(),
  autoDeploy: z.boolean().optional(),
  extraNotes: z.string().max(500).optional(),
  questType: z.enum(["custom", "daily", "weekly"]).optional(),
})

const questOutputSchema = z.object({
  title: z.string(),
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
      tokenIn: z.string().optional(),
      tokenOut: z.string().optional(),
      minAmountIn: z.number().optional(),
      minAmountOut: z.number().optional(),
      actionType: z.enum(["swap", "deposit", "borrow", "stake"]).optional(),
    })
    .optional(),
})

const parser = StructuredOutputParser.fromZodSchema(questOutputSchema)
type QuestDraft = z.infer<typeof questOutputSchema>

const questPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a DeFi quest designer for Vael, a cross-chain quest game. Players act on Ethereum Sepolia and the Attestcoin Protocol proves that transaction on Creditcoin, where QuestASC verifies it and releases the reward. Generate ONE concrete, on-chain verifiable quest from the given goal and context. Output ONLY valid JSON - no markdown, no commentary.

## Output Format
Return strictly valid JSON matching the schema. No code blocks, no explanation.

## Protocols (Ethereum Sepolia, the source chain)
- Uniswap v3 (0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E): DEX - swaps. https://app.uniswap.org
- Aave v3 (0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951): Lending - supply, borrow. https://app.aave.com
- Vael Quest Portal: check-in and deposit, emits QuestActionPerformed.

## Field Rules

**goal** (input): You receive this. Use it verbatim or refine minimally. It defines the quest objective.

**verificationParams** (required for auto-verify): Parse the goal to derive:
- tokenIn: Token the participant sends (swap input, supply). tokenOut: Token received (swap output, borrow). Native ETH is WETH9.
- minAmountIn: Min human units of tokenIn. Use for swap and supply. Token addresses on Sepolia: USDC=${SEPOLIA_TOKENS.USDC}, WETH9=${SEPOLIA_TOKENS.WETH9}, DAI=${SEPOLIA_TOKENS.AAVE_DAI}, LINK=${SEPOLIA_TOKENS.AAVE_LINK}.
- minAmountOut: ONLY for borrow (min tokenOut received). NEVER use for swap — swap output depends on market price and cannot be predicted.
- Examples: swap USDC to WETH9: tokenIn=USDC, tokenOut=WETH9, minAmountIn=10 (no minAmountOut). Supply USDC: tokenIn=USDC, minAmountIn=10. Borrow USDC: tokenOut=USDC, minAmountOut=100.
- actionType: swap | supply | borrow | transfer | portal. Infer from goal. Each maps to one decoded log signature.

**difficulty**: easy (simple, few steps) | medium | hard. Daily quests → easy/medium. Weekly → can be harder.

**steps**: 3-6 ordered, actionable steps. Each: action + how to verify. End with the Sepolia transaction confirming on Etherscan, then the proof verifying on Creditcoin.

**requirements**: 2–5 prerequisites. Wallet, tokens, protocol access.`,
  ],
  [
    "human",
    `## Input
Project: {projectName}
Protocol: {protocol}
Protocol info: {protocolInfo}
Network: {chain}
Goal: {goal}
Category: {categoryHint}
Participant: {participant}
Reward: {rewardAmount} VAEL
Notes: {extraNotes}

Generate a quest that fulfills the goal. Derive verificationParams from the goal. If notes mention "daily" or "weekly", adjust complexity accordingly.

## Schema
{formatInstructions}`,
  ],
])

const groqModel = new ChatGroq({
  apiKey: serviceEnv().GROQ_API_KEY,
  model: "openai/gpt-oss-20b",
  temperature: 0.3,
})

const chain = questPrompt.pipe(groqModel).pipe(parser)

export async function generateQuestWithGroq(rawInput: unknown) {
  const input = generationInputSchema.parse(rawInput)

  // Validate protocol address
  const protocol = getProtocolByAddress(input.protocol)
  if (!protocol) {
    throw new Error(
      `Invalid protocol address: ${input.protocol}. Supported protocols: ${Object.values(PROTOCOLS)
        .map((p) => `${p.name} (${p.evmAddress})`)
        .join(", ")}`
    )
  }

  // Build protocol info string for AI
  const protocolInfo = `${protocol.name} - ${protocol.description}. Category: ${protocol.category}. Website: ${protocol.website}`

  // Get format instructions to pass as variable
  const formatInstructions = parser.getFormatInstructions()

  const questDraft = (await chain.invoke({
    projectName: input.projectName,
    protocol: protocol.name,
    protocolInfo,
    chain: input.chain,
    goal: input.goal,
    categoryHint: input.categoryHint ?? protocol.category,
    participant: input.participant,
    rewardAmount: input.rewardAmount,
    extraNotes: input.extraNotes ?? "No extra notes",
    formatInstructions,
  })) as QuestDraft

  let onChainResult: Awaited<ReturnType<typeof createQuest>> | undefined
  const protocolAddressToUse = getProtocolRouterAddress(input.protocol)

  // Prepare metadata payload (used for both auto-deploy and logging)
  const metadataPayload = {
    title: questDraft.title,
    summary: questDraft.shortSummary,
    projectName: input.projectName,
    chain: input.chain,
    goal: input.goal,
    difficulty: questDraft.difficulty,
    category: questDraft.recommendedCategory,
    requirements: questDraft.requirements,
    steps: questDraft.steps,
    parameters: questDraft.parameters,
    reward: {
      token: "VAEL",
      amount: input.rewardAmount,
      badgeLevel: input.badgeLevel,
    },
    participant: input.participant,
    extraNotes: input.extraNotes,
    metadataSnippet: questDraft.metadataSnippet,
    banner: undefined,
    verificationParams: questDraft.verificationParams ?? undefined,
  }

  if (input.autoDeploy) {
    let metadataURI =
      input.metadataURI ??
      (await uploadQuestMetadata(metadataPayload, `quest-${questDraft.title.slice(0, 32)}`))

    onChainResult = await createQuest({
      category: questDraft.recommendedCategory,
      protocol: protocolAddressToUse,
      metadataURI,
      rewardAmount: input.rewardAmount,
      badgeLevel: input.badgeLevel,
      participant: input.participant,
      expiry: input.expiry,
      parameters: questDraft.parameters.actionPlan,
    })

    // Get quest details from on-chain to save to DB
    const questIdOnChain = Number(onChainResult.questId)
    const onChainQuest = await getQuestById(questIdOnChain)

    // Save quest metadata to database
    const questData: Parameters<typeof saveQuest>[0] = {
      quest_id_on_chain: questIdOnChain,
      title: questDraft.title,
      description: questDraft.shortSummary,
      project_name: input.projectName,
      category: questDraft.recommendedCategory,
      protocol_address: protocolAddressToUse,
      metadata_uri: metadataURI,
      reward_per_participant: input.rewardAmount,
      badge_level: input.badgeLevel,
      assigned_participant: input.participant,
      status: "active",
    }

    if (onChainQuest.agentId) {
      questData.agent_id = Number(onChainQuest.agentId)
    }
    if (onChainQuest.agentController) {
      questData.agent_controller = onChainQuest.agentController
    }
    if (input.expiry) {
      questData.expiry_timestamp = Number(input.expiry)
    }

    const savedQuest = await saveQuest({
      ...questData,
      quest_type: input.questType || "custom", // Use provided questType or default to custom
    })

    // Log AI generation
    await logAIGeneration({
      quest_id_on_chain: questIdOnChain,
      prompt_input: input,
      ai_output: questDraft,
      metadata_uri: metadataURI,
      deployed_on_chain: true,
      deployment_tx_hash: onChainResult.transactionHash,
    })
  } else {
    // Upload metadata to IPFS even if not auto-deploying
    const metadataURIForLog =
      input.metadataURI ??
      (await uploadQuestMetadata(metadataPayload, `quest-${questDraft.title.slice(0, 32)}`))

    // Log AI generation even if not deployed
    await logAIGeneration({
      prompt_input: input,
      ai_output: questDraft,
      metadata_uri: metadataURIForLog,
      deployed_on_chain: false,
    })
  }

  return {
    questDraft,
    onChainResult,
  }
}


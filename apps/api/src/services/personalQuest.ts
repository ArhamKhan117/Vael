import { ChatGroq } from "@langchain/groq"
import { Contract } from "ethers"
import { z } from "zod"

import { creditcoinProvider } from "../attestcoin/config"
import { createWorkerStore } from "../attestcoin/store"
import { serviceEnv } from "../config/env"
import { VAEL_HERO_READ_ABI } from "../indexer/abi"
import { pinActionBanner } from "./actionArt"
import { uploadQuestMetadata } from "./ipfsService"
import { QuestTemplate, createQuests } from "./campaignQuests"

/**
 * Quests generated from what a player has actually proved.
 *
 * The input is the verified-action index and the hero, never a raw wallet feed. That is not a
 * privacy nicety: every row in the index exists because Creditcoin emitted it after checking a
 * Merkle proof and a continuity proof, so the model is reasoning about facts the chain agreed to
 * rather than about whatever an RPC happened to return.
 *
 * **The model does not choose the emitter.** It picks an action type and a difficulty, and the
 * server maps that to an emitter and token from the allowlist QuestASC already enforces. A model
 * that could name a contract address could name one it invented, and a hallucinated emitter in a
 * verification rule is a quest that accepts the wrong log.
 */

/** The model that generates these. Recorded in docs/ATTESTCOIN_INTEGRATION.md. */
export const MODEL = "openai/gpt-oss-20b"
export const TEMPERATURE = 0.2

/** Action types, mirroring VaelTypes.ActionType. */
const ACTION_NAMES = ["portal", "uniswapSwap", "erc20Transfer", "aaveSupply", "aaveBorrow"] as const
type ActionName = (typeof ACTION_NAMES)[number]

/**
 * Emitter and token per action, from the environment rather than from the model.
 *
 * These are the same addresses QuestASC's own allowlist holds, so a rule built here can only ever
 * name a contract the chain would accept anyway.
 */
function emitterFor(action: ActionName): { emitter: string; token: string; unitDecimals: number } {
  const zero = "0x0000000000000000000000000000000000000000"
  switch (action) {
    case "portal":
      return { emitter: required("QUEST_PORTAL_ADDRESS"), token: zero, unitDecimals: 18 }
    case "uniswapSwap":
      return {
        emitter: required("SEPOLIA_POOL_USDC_WETH_500"),
        token: required("SEPOLIA_USDC"),
        unitDecimals: 6,
      }
    case "erc20Transfer":
      return { emitter: required("SEPOLIA_USDC"), token: required("SEPOLIA_USDC"), unitDecimals: 6 }
    case "aaveSupply":
    case "aaveBorrow":
      return {
        emitter: required("SEPOLIA_AAVE_POOL"),
        token: required("SEPOLIA_AAVE_LINK"),
        unitDecimals: 18,
      }
  }
}

function required(name: string): string {
  const value = process.env[name]
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

/**
 * What the model is allowed to decide.
 *
 * Nothing here can name a contract, an amount in base units, or a reward outside the band the
 * server sets. The bounds are the guard rail: a model asking for a thousand-fold minimum would
 * produce a quest nobody can complete, and one asking for a million VAEL would drain the vault.
 */
const draftSchema = z.object({
  title: z.string().min(4).max(80),
  summary: z.string().min(20).max(400),
  action: z.enum(ACTION_NAMES),
  /** Multiplied by the action's base unit to get the on-chain minimum. */
  difficulty: z.number().min(1).max(50),
  rewardVael: z.number().min(10).max(500),
  badgeLevel: z.number().int().min(1).max(5),
  reasoning: z.string().min(10).max(400),
})

export type QuestDraft = z.infer<typeof draftSchema>

export interface PlayerProfile {
  address: string
  hasHero: boolean
  level: number
  strength: number
  agility: number
  intellect: number
  streak: number
  /** How many verified actions of each type, keyed by name. */
  proved: Record<ActionName, number>
  totalProved: number
  /** The most recent verified actions, newest first, as short descriptions. */
  recent: string[]
}

/**
 * Build a profile from the index and the hero contract, and nothing else.
 */
export async function profileOf(address: string): Promise<PlayerProfile> {
  const store = createWorkerStore()
  await store.init()
  const actions = await store.actions(address)

  const proved = Object.fromEntries(ACTION_NAMES.map((name) => [name, 0])) as Record<ActionName, number>
  for (const action of actions) {
    const name = ACTION_NAMES[action.actionType]
    if (name) proved[name] += 1
  }

  const profile: PlayerProfile = {
    address: address.toLowerCase(),
    hasHero: false,
    level: 0,
    strength: 0,
    agility: 0,
    intellect: 0,
    streak: 0,
    proved,
    totalProved: actions.length,
    recent: actions.slice(0, 5).map(
      (action) =>
        `${ACTION_NAMES[action.actionType] ?? action.actionType} of ${action.amount} units at Sepolia block ${action.sourceBlock}`
    ),
  }

  const heroAddress = process.env.VAEL_HERO_ADDRESS
  if (heroAddress && /^0x[0-9a-fA-F]{40}$/.test(heroAddress)) {
    const hero = new Contract(heroAddress, VAEL_HERO_READ_ABI, creditcoinProvider())
    const tokenId: bigint = await hero.getFunction("heroOf").staticCall(address)
    if (tokenId > 0n) {
      const h = await hero.getFunction("heroByAddress").staticCall(address)
      profile.hasHero = true
      profile.level = Number(h[0])
      profile.strength = Number(h[2])
      profile.agility = Number(h[3])
      profile.intellect = Number(h[4])
      profile.streak = Number(h[7])
    }
  }

  return profile
}

/**
 * The prompt. Recorded verbatim in docs/ATTESTCOIN_INTEGRATION.md, because a generated quest is
 * only auditable if the instruction that produced it is written down.
 */
export const PROMPT_TEMPLATE = `You design one quest for one player of Vael, a game where every reward is released by an on-chain proof of a real DeFi action on Ethereum Sepolia.

You are given only what the chain has verified about this player. Nothing here is self-reported.

Player: {address}
Hero: {heroLine}
Verified actions so far: {totalProved}
By type: {byType}
Most recent: {recent}

Pick ONE action type for their next quest from exactly this list: portal, uniswapSwap, erc20Transfer, aaveSupply, aaveBorrow.

Rules you must follow:
- Choose an action that moves this player forward. A player with nothing proved should be given "portal", the simplest action. A player who has only ever done one type should be nudged towards a different one.
- "difficulty" is a multiplier on the action's base minimum, from 1 to 50. Keep it near 1 for a new player and raise it for a player with many verified actions.
- "rewardVael" is between 10 and 500 and should scale with difficulty.
- "badgeLevel" is 1 to 5 and should scale with difficulty.
- "reasoning" must cite what the player has actually proved. Do not invent history.
- Never name a contract address. The server chooses those.

{formatInstructions}`

let model: ChatGroq | undefined
function groq(): ChatGroq {
  if (!model) {
    model = new ChatGroq({
      apiKey: serviceEnv().GROQ_API_KEY,
      model: MODEL,
      temperature: TEMPERATURE,
    })
  }
  return model
}

const FORMAT_INSTRUCTIONS = `Reply with JSON only, no prose and no code fences, exactly:
{"title": string, "summary": string, "action": one of portal|uniswapSwap|erc20Transfer|aaveSupply|aaveBorrow, "difficulty": number 1-50, "rewardVael": number 10-500, "badgeLevel": integer 1-5, "reasoning": string}`

function renderPrompt(profile: PlayerProfile): string {
  const heroLine = profile.hasHero
    ? `level ${profile.level}, ${profile.strength} strength, ${profile.agility} agility, ${profile.intellect} intellect, streak ${profile.streak}`
    : "no hero minted yet"
  const byType = ACTION_NAMES.map((name) => `${name} ${profile.proved[name]}`).join(", ")
  return PROMPT_TEMPLATE.replace("{address}", profile.address)
    .replace("{heroLine}", heroLine)
    .replace("{totalProved}", String(profile.totalProved))
    .replace("{byType}", byType)
    .replace("{recent}", profile.recent.length > 0 ? profile.recent.join("; ") : "none")
    .replace("{formatInstructions}", FORMAT_INSTRUCTIONS)
}

/** Strip the code fence some models add around JSON despite being told not to. */
function parseDraft(raw: string): QuestDraft {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error(`the model did not return JSON: ${raw.slice(0, 200)}`)
  return draftSchema.parse(JSON.parse(cleaned.slice(start, end + 1)))
}

export interface GeneratedQuest {
  draft: QuestDraft
  profile: PlayerProfile
  metadataUri: string
  metadataCid: string
  questId: number
  txHash: string
  blockNumber: number
  gasUsed: number
  rule: { actionType: number; emitter: string; token: string; minAmount: string }
  reward: string
}

/**
 * Generate one quest for one player, pin its metadata, and create it on chain.
 *
 * `cadence` is recorded in the metadata so a daily and a weekly quest are distinguishable
 * afterwards without guessing from timestamps.
 */
export async function generatePersonalQuest(
  address: string,
  cadence: "daily" | "weekly" | "manual" = "manual"
): Promise<GeneratedQuest> {
  const profile = await profileOf(address)

  const response = await groq().invoke(renderPrompt(profile))
  const raw = typeof response.content === "string" ? response.content : JSON.stringify(response.content)
  const draft = parseDraft(raw)

  const { emitter, token, unitDecimals } = emitterFor(draft.action)
  const actionType = ACTION_NAMES.indexOf(draft.action)

  // The base unit is deliberately small: the minimum is a floor a player must clear, not a target,
  // and a floor nobody can reach is a quest that cannot be completed.
  const base = unitDecimals === 6 ? 100_000n : 500_000_000_000_000n
  const minAmount = base * BigInt(Math.round(draft.difficulty))
  const reward = BigInt(Math.round(draft.rewardVael)) * 10n ** 18n

  // The artwork for the action the model chose. Pinned, so the quest carries its own picture
  // wherever the metadata is read, rather than only where this site happens to be serving files.
  const banner = await pinActionBanner(actionType)

  const metadata = {
    name: draft.title,
    description: draft.summary,
    ...(banner ? { banner, image: banner } : {}),
    attributes: [
      { trait_type: "Action", value: draft.action },
      { trait_type: "Cadence", value: cadence },
      { trait_type: "Difficulty", value: draft.difficulty },
      { trait_type: "Badge level", value: draft.badgeLevel },
      { trait_type: "Generated for", value: profile.address },
    ],
    vael: {
      generatedBy: MODEL,
      temperature: TEMPERATURE,
      reasoning: draft.reasoning,
      // What the model was reasoning about, so a quest can be audited against the same facts.
      evidence: {
        verifiedActions: profile.totalProved,
        byType: profile.proved,
        heroLevel: profile.level,
      },
      rule: {
        actionType,
        emitter,
        token,
        minAmount: minAmount.toString(),
        sourceChainKey: 1,
      },
    },
  }

  const metadataUri = await uploadQuestMetadata(metadata, `vael-quest-${profile.address.slice(0, 10)}-${Date.now()}`)
  const metadataCid = metadataUri.replace("ipfs://", "")

  const template: QuestTemplate = {
    actionType,
    emitter,
    token,
    minAmount: minAmount.toString(),
    rewardPerParticipant: reward.toString(),
    badgeLevel: draft.badgeLevel,
    playerMustMatch: true,
    category: 0,
    metadataURI: metadataUri,
    sourceChainKey: 1,
  }

  // campaignId 0: this is a protocol quest paid from RewardVault, not from a partner's escrow.
  const [created] = await createQuests(0n, address, [template])
  if (!created) throw new Error("createQuest returned nothing")

  return {
    draft,
    profile,
    metadataUri,
    metadataCid,
    questId: created.questId,
    txHash: created.txHash,
    blockNumber: created.blockNumber,
    gasUsed: created.gasUsed,
    rule: { actionType, emitter, token, minAmount: minAmount.toString() },
    reward: reward.toString(),
  }
}

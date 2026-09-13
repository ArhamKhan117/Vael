import { keccak256, parseUnits, stringToHex, getAddress } from "viem"
import { z } from "zod"

import {
  agentControllerAccount,
  agentControllerWalletClient,
  publicClient,
  questManagerAbi,
  questManagerAddress,
} from "../lib/contracts"
import { QuestCategoryToValue, serializeQuest } from "../lib/quest"

const addressRegex = /^0x[a-fA-F0-9]{40}$/
const bytes32Regex = /^0x[a-fA-F0-9]{64}$/

const createQuestSchema = z.object({
  category: z.enum(["swap", "liquidity", "stake", "lend"]),
  protocol: z.string().regex(addressRegex),
  metadataURI: z.string().min(1).max(200),
  rewardAmount: z.string().min(1),
  badgeLevel: z.number().int().positive(),
  participant: z.string().regex(addressRegex),
  expiry: z.number().int().nonnegative().optional(),
  parametersHash: z.string().regex(bytes32Regex).optional(),
  parameters: z.string().min(1).optional(),
})

export async function createQuest(input: unknown) {
  const parsed = createQuestSchema.parse(input)

  const parametersHash =
    parsed.parametersHash ??
    keccak256(stringToHex(parsed.parameters ?? parsed.metadataURI))

  const rewardPerParticipant = parseUnits(parsed.rewardAmount, 18)

  const questParams = {
    category: QuestCategoryToValue[parsed.category],
    protocol: parsed.protocol as `0x${string}`,
    parametersHash,
    metadataURI: parsed.metadataURI,
    rewardPerParticipant,
    expiry: parsed.expiry ?? 0,
    badgeLevel: BigInt(parsed.badgeLevel),
    participant: parsed.participant as `0x${string}`,
  }

  // Use agent controller wallet for createQuest
  const simulation = await publicClient.simulateContract({
    account: agentControllerAccount,
    address: questManagerAddress,
    abi: questManagerAbi,
    functionName: "createQuest",
    args: [questParams],
  })

  const hash = await agentControllerWalletClient.writeContract(simulation.request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  return {
    questId: (simulation.result as bigint).toString(),
    transactionHash: receipt.transactionHash,
  }
}

export async function getQuestById(questId: number) {
  const quest = await publicClient.readContract({
    address: questManagerAddress,
    abi: questManagerAbi,
    functionName: "getQuest",
    args: [BigInt(questId)],
  })
  return serializeQuest(quest, questId)
}

export async function getParticipantProgress(questId: number, participant: string) {
  const normalizedAddress = getAddress(participant)
  const progress = (await publicClient.readContract({
    address: questManagerAddress,
    abi: questManagerAbi,
    functionName: "participantProgress",
    args: [BigInt(questId), normalizedAddress],
  })) as { accepted: boolean; completed: boolean }

  return {
    accepted: progress.accepted,
    completed: progress.completed,
  }
}

// recordCompletion is intentionally absent. QuestManager.recordCompletion is gated by
// onlyQuestASC, so only the on-chain verifier can complete a quest. The proof worker
// submits proofs; it never records a completion itself.

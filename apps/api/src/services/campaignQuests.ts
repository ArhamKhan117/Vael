import { Contract, keccak256, toUtf8Bytes } from "ethers"

import { creditcoinProvider, workerWallet } from "../attestcoin/config"

/**
 * Creating a campaign's quests on chain.
 *
 * This is the step that makes a campaign proof-gated rather than a database row. Until a quest
 * exists on QuestManager with its `VerificationRule` and its `campaignId`, nothing can pay out of
 * `CampaignEscrow`, because the only caller `CampaignEscrow` accepts is QuestASC and the only path
 * QuestASC takes to it is a verified proof.
 *
 * Creation is permissioned and completion is not, which is the whole shape of the trust model: an
 * ERC-8004 registered agent decides what a quest asks for, and only the Attestcoin precompile
 * decides whether somebody did it.
 */

const QUEST_MANAGER_ABI = [
  "function createQuest((uint8 category,address protocol,bytes32 parametersHash,string metadataURI,uint256 rewardPerParticipant,uint64 expiry,uint256 badgeLevel,address participant,uint64 sourceChainKey,uint256 campaignId,(uint8 actionType,address emitter,address token,uint256 minAmount,uint64 minSourceBlock,uint64 maxSourceBlock,bool playerMustMatch) rule) params) returns (uint256)",
  "function getQuest(uint256 questId) view returns ((uint256 agentId,address agentController,uint8 category,address protocol,bytes32 parametersHash,string metadataURI,address rewardToken,uint256 rewardPerParticipant,uint256 badgeLevel,address assignedParticipant,uint32 acceptedCount,uint32 completedCount,uint64 expiry,uint8 status,uint64 createdAt,uint64 sourceChainKey,uint256 campaignId))",
  "event QuestCreated(uint256 indexed questId, uint256 indexed agentId, address indexed agentController, uint8 category, address protocol)",
]

/** Mirrors VaelTypes.ActionType. */
export const ACTION_TYPES = {
  portal: 0,
  uniswapSwap: 1,
  erc20Transfer: 2,
  aaveSupply: 3,
  aaveBorrow: 4,
  penguinSwapSwap: 5,
  wrapNative: 6,
} as const

/**
 * Mirrors VaelTypes.FIRST_NATIVE_ACTION.
 *
 * QuestManager reads the action type at creation and files the quest to one completion path
 * permanently: below this, a rule is registered on QuestASC and the quest is settled against an
 * Attestcoin proof; at or above it, the quest is settled by NativePortal, which performs the action
 * itself. Nothing downstream may treat the two as interchangeable.
 */
export const FIRST_NATIVE_ACTION = ACTION_TYPES.penguinSwapSwap

export function isNativeAction(actionType: number): boolean {
  return actionType >= FIRST_NATIVE_ACTION
}

/** Mirrors QuestManager.QuestCategory, which is display only. */
export const CATEGORIES = { swap: 0, liquidity: 1, stake: 2, lend: 3, other: 4 } as const

export interface QuestTemplate {
  /** 0 Portal through 4 AaveBorrow. */
  actionType: number
  /** The contract whose log counts. Checked against QuestASC's allowlist as well. */
  emitter: string
  /** Token the action must involve, or the zero address for any. */
  token: string
  /** Smallest amount that counts, in the token's own units. */
  minAmount: string
  rewardPerParticipant: string
  badgeLevel: number
  /** Whether the address in the log must be the accepting participant. Always true in practice. */
  playerMustMatch: boolean
  category: number
  metadataURI: string
  sourceChainKey: number
}

export interface CreatedQuest {
  questId: number
  txHash: string
  blockNumber: number
  gasUsed: number
  participant: string
}

/**
 * The escrow keys campaigns by `bytes32`, QuestManager by `uint256`, and QuestASC casts one to the
 * other. Both sides must derive the same value from the same campaign or a payout would target an
 * empty pool.
 */
export function campaignIdToUint(campaignId: string): bigint {
  return BigInt(keccak256(toUtf8Bytes(campaignId)))
}

function questManagerAddress(): string {
  const address = process.env.QUEST_MANAGER_ADDRESS
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("QUEST_MANAGER_ADDRESS is not configured")
  }
  return address
}

/**
 * Create one quest per template, assigned to one participant.
 *
 * One transaction per quest: `createQuest` funds the vault and registers the rule in QuestASC, and
 * batching them would only make a partial failure harder to read.
 */
export async function createCampaignQuests(
  campaignId: string,
  participant: string,
  templates: QuestTemplate[]
): Promise<CreatedQuest[]> {
  return createQuests(campaignIdToUint(campaignId), participant, templates)
}

/**
 * Create quests bound to an explicit on-chain campaign id.
 *
 * Zero means "paid from RewardVault, not from a partner's escrow". It has to be passed as a number
 * rather than derived from a string, because `campaignIdToUint("")` is the hash of the empty
 * string, which is emphatically not zero: a quest carrying it would try to pay out of an escrow
 * pool that has never existed and revert at completion, after the player had done the work.
 */
export async function createQuests(
  onChainCampaignId: bigint,
  participant: string,
  templates: QuestTemplate[]
): Promise<CreatedQuest[]> {
  const wallet = workerWallet()
  const manager = new Contract(questManagerAddress(), QUEST_MANAGER_ABI, wallet)

  const created: CreatedQuest[] = []
  for (const template of templates) {
    const params = {
      category: template.category,
      protocol: template.emitter,
      parametersHash: keccak256(
        toUtf8Bytes(`${onChainCampaignId}:${participant}:${template.actionType}:${template.minAmount}`)
      ),
      metadataURI: template.metadataURI,
      rewardPerParticipant: BigInt(template.rewardPerParticipant),
      expiry: 0n,
      badgeLevel: BigInt(template.badgeLevel),
      participant,
      sourceChainKey: BigInt(template.sourceChainKey),
      campaignId: onChainCampaignId,
      rule: {
        actionType: template.actionType,
        emitter: template.emitter,
        token: template.token,
        minAmount: BigInt(template.minAmount),
        minSourceBlock: 0n,
        maxSourceBlock: 0n,
        playerMustMatch: template.playerMustMatch,
      },
    }

    const tx = await manager.getFunction("createQuest")(params)
    const receipt = await tx.wait()
    if (!receipt || receipt.status !== 1) {
      throw new Error(`createQuest reverted (tx ${tx.hash})`)
    }

    // The id comes from the event rather than from a counter read, so a concurrent creation
    // cannot make this report somebody else's quest.
    const questId = receipt.logs
      .map((log: { topics: string[]; data: string }) => {
        try {
          return manager.interface.parseLog({ topics: [...log.topics], data: log.data })
        } catch {
          return null
        }
      })
      .find((parsed: { name: string } | null) => parsed?.name === "QuestCreated")

    if (!questId) throw new Error(`createQuest emitted no QuestCreated (tx ${tx.hash})`)

    created.push({
      questId: Number((questId as unknown as { args: { questId: bigint } }).args.questId),
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: Number(receipt.gasUsed),
      participant,
    })
  }

  return created
}

/** Read a quest back, so a caller can prove what actually landed rather than what was sent. */
export async function readQuest(questId: number) {
  const manager = new Contract(questManagerAddress(), QUEST_MANAGER_ABI, creditcoinProvider())
  const quest = await manager.getFunction("getQuest").staticCall(questId)
  // Indices follow QuestManager.Quest exactly, including acceptedCount and completedCount before
  // expiry. Getting this wrong reads a timestamp as a chain key and silently answers nonsense.
  return {
    questId,
    agentController: quest[1],
    metadataURI: quest[5],
    rewardPerParticipant: quest[7].toString(),
    badgeLevel: Number(quest[8]),
    assignedParticipant: quest[9],
    acceptedCount: Number(quest[10]),
    completedCount: Number(quest[11]),
    expiry: Number(quest[12]),
    status: Number(quest[13]),
    createdAt: Number(quest[14]),
    sourceChainKey: Number(quest[15]),
    campaignId: quest[16].toString(),
  }
}

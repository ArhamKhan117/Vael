const CATEGORY_LABELS = ["Swap", "Liquidity", "Stake", "Lend"] as const
const STATUS_LABELS = ["Inactive", "Active", "Completed", "Cancelled"] as const

export type QuestCategory = (typeof CATEGORY_LABELS)[number]

export const QuestCategoryToValue: Record<string, number> = {
  swap: 0,
  liquidity: 1,
  stake: 2,
  lend: 3,
}

export function serializeQuest(quest: any, questId: bigint | number) {
  return {
    id: questId.toString(),
    agentId: quest.agentId?.toString(),
    agentController: quest.agentController,
    categoryValue: Number(quest.category),
    category: CATEGORY_LABELS[Number(quest.category)] ?? "Unknown",
    protocol: quest.protocol,
    parametersHash: quest.parametersHash,
    metadataURI: quest.metadataURI,
    rewardToken: quest.rewardToken,
    rewardPerParticipant: quest.rewardPerParticipant?.toString(),
    badgeLevel: quest.badgeLevel?.toString(),
    assignedParticipant: quest.assignedParticipant,
    acceptedCount: quest.acceptedCount?.toString(),
    completedCount: quest.completedCount?.toString(),
    expiry: quest.expiry?.toString(),
    statusValue: Number(quest.status),
    status: STATUS_LABELS[Number(quest.status)] ?? "Unknown",
    createdAt: quest.createdAt?.toString(),
  }
}


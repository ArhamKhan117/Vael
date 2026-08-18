/**
 * QuestManager contract ABI - acceptQuest for daily/weekly quests
 */
export const QUEST_MANAGER_ABI = [
  {
    type: "function",
    name: "acceptQuest",
    inputs: [
      { name: "questId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

export const QUEST_MANAGER_ADDRESS = (
  process.env.NEXT_PUBLIC_QUEST_MANAGER_ADDRESS ||
  "0x2BFA986A1e40f8F2C3a6B518a6DFD570A43905dF"
) as `0x${string}`

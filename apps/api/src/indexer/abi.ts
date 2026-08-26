/** Events the indexer reads from Creditcoin. Only the ones it actually decodes are declared. */
export const INDEXER_ABI = [
  // QuestManager
  "event QuestCreated(uint256 indexed questId, uint256 indexed agentId, address indexed agentController, uint8 category, address protocol)",
  "event QuestAccepted(uint256 indexed questId, address indexed participant, uint64 sourceChainKey, uint64 acceptedAtSourceHeight)",
  "event QuestCompleted(uint256 indexed questId, address indexed participant, bytes32 indexed replayKey, bytes32 sourceTxHash)",
  // QuestASC
  "event RuleRegistered(uint256 indexed questId, uint64 sourceChainKey, uint8 actionType)",
  "event QuestProofApplied(uint256 indexed questId, address indexed player, uint8 indexed actionType, bytes32 replayKey, uint64 sourceBlock, uint256 amount)",
  // VaelHero
  "event HeroMinted(address indexed player, uint256 indexed tokenId)",
  "event HeroXPGranted(address indexed player, uint256 indexed tokenId, uint8 actionType, uint8 tier, uint64 xpGained, bytes32 replayKey)",
  "event HeroLeveled(address indexed player, uint256 indexed tokenId, uint32 newLevel)",
  // RaidBoss
  "event SeasonStarted(uint64 indexed seasonId, uint256 maxHp, uint256 lootPool)",
  "event RaidDamage(uint64 indexed seasonId, address indexed player, uint256 damage, uint256 hpRemaining, uint8 actionType, bytes32 replayKey)",
  "event RaidDefeated(uint64 indexed seasonId, address indexed lastHitter, uint256 totalDamage)",
  // BadgeNFT. Both signatures are declared: the deployed v2 emits four arguments and the rarity is
  // derived from the badge level, v3 emits the rarity itself. Different argument lists mean
  // different topic0 values, so one interface decodes whichever is live.
  "event BadgeMinted(address indexed to, uint256 indexed questId, uint256 badgeLevel, uint256 tokenId)",
  "event BadgeMinted(address indexed to, uint256 indexed questId, uint256 badgeLevel, uint256 tokenId, uint8 rarity)",

  // RewardVault
  "event RewardReleased(uint256 indexed questId, address indexed recipient, uint256 amount)",

  "event LootClaimed(uint64 indexed seasonId, address indexed player, uint256 amount, bool lastHitBonus)",
] as const

/** Reads used to fill in state the events do not carry. */
export const QUEST_ASC_READ_ABI = [
  "function rules(uint256 questId) view returns (uint8 actionType, address emitter, address token, uint256 minAmount, uint64 minSourceBlock, uint64 maxSourceBlock, bool playerMustMatch)",
] as const

export const QUEST_MANAGER_READ_ABI = [
  "function verificationContext(uint256 questId) view returns (bool exists, bool active, address assignedParticipant, uint64 expiry, uint64 sourceChainKey, uint256 campaignId)",
] as const

export const VAEL_HERO_READ_ABI = [
  "function heroByAddress(address player) view returns (tuple(uint32 level, uint64 xp, uint16 strength, uint16 agility, uint16 intellect, uint16[4] equipment, uint64 lastActionSourceBlock, uint16 streak))",
  "function heroOf(address player) view returns (uint256)",
] as const

export const RAID_BOSS_READ_ABI = [
  "function currentSeasonId() view returns (uint64)",
  "function currentSeason() view returns (tuple(uint256 maxHp, uint256 hp, uint64 seasonId, uint256 lootPool, address lastHitter, bool defeated, uint256 totalDamage))",
  "function damageOf(uint64 seasonId, address player) view returns (uint256)",
  "function pendingLoot(uint64 seasonId, address player) view returns (uint256)",
] as const

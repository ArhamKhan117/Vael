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
  // A hero carried across the milestone 8 redeploy. It is the only way a hero appears on the new
  // contract without a proof, and the index has to see it or a migrated player looks heroless.
  "event HeroImported(address indexed player, uint256 indexed tokenId, uint32 level, uint64 xp)",
  // RaidBoss
  "event SeasonStarted(uint64 indexed seasonId, uint256 maxHp, uint256 lootPool)",
  "event RaidDamage(uint64 indexed seasonId, address indexed player, uint256 damage, uint256 hpRemaining, uint8 actionType, bytes32 replayKey)",
  "event RaidDefeated(uint64 indexed seasonId, address indexed lastHitter, uint256 totalDamage)",
  // Arena
  "event ArenaChallenged(uint256 indexed challengeId, address indexed challenger, address indexed opponent, uint256 stake)",
  // Two signatures, as with BadgeMinted: the superseded Arena emitted three arguments and the
  // current one emits the committed seed block as a fourth. Different argument lists mean
  // different topic0 values, so one interface decodes whichever is live.
  "event ArenaAccepted(uint256 indexed challengeId, address indexed opponent, uint64 acceptedAtBlock)",
  "event ArenaAccepted(uint256 indexed challengeId, address indexed opponent, uint64 acceptedAtBlock, uint64 seedBlock)",
  "event ArenaVoided(uint256 indexed challengeId, address indexed challenger, address indexed opponent, uint256 refund)",
  "event ArenaResolved(uint256 indexed challengeId, address indexed winner, address indexed loser, uint256 payout, uint256 burned, bytes32 seed, bytes rounds)",
  "event ArenaDrawn(uint256 indexed challengeId, address challengerRefund, address opponentRefund, bytes32 seed, bytes rounds)",
  "event ArenaCancelled(uint256 indexed challengeId, address indexed challenger, uint256 refund)",
  "event ArenaExpired(uint256 indexed challengeId, address indexed challenger, uint256 refund)",

  // Loot. Its LootClaimed carries five arguments where RaidBoss's carries four, so the two have
  // different topic0 values and one interface decodes both.
  "event LootClaimed(uint64 indexed seasonId, address indexed player, uint256 indexed itemId, uint256 shareBps, uint8 rarity)",
  "event LootMinted(address indexed to, uint256 indexed itemId, uint8 rarity, bytes32 reason)",

  // Equipment
  "event Equipped(uint256 indexed heroTokenId, uint8 indexed slot, uint256 indexed itemId, address owner)",
  "event Unequipped(uint256 indexed heroTokenId, uint8 indexed slot, uint256 indexed itemId, address owner)",

  // Marketplace
  "event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed itemId, uint256 amount, uint256 price)",
  "event Cancelled(uint256 indexed listingId, address indexed seller, uint256 indexed itemId, uint256 amount)",
  "event Sold(uint256 indexed listingId, address indexed seller, address indexed buyer, uint256 itemId, uint256 amount, uint256 price, uint256 fee)",

  // BadgeNFT. Both signatures are declared: the deployed v2 emits four arguments and the rarity is
  // derived from the badge level, v3 emits the rarity itself. Different argument lists mean
  // different topic0 values, so one interface decodes whichever is live.
  "event BadgeMinted(address indexed to, uint256 indexed questId, uint256 badgeLevel, uint256 tokenId)",
  "event BadgeMinted(address indexed to, uint256 indexed questId, uint256 badgeLevel, uint256 tokenId, uint8 rarity)",

  // RewardVault
  "event RewardReleased(uint256 indexed questId, address indexed recipient, uint256 amount)",

  // CampaignEscrow. The pool is the only thing that makes a campaign real, so the campaign list is
  // built from these three and nothing else.
  "event Deposited(bytes32 indexed campaignId, address indexed depositor, uint256 amount, uint256 feeAmount)",
  "event Released(bytes32 indexed campaignId, address indexed recipient, uint256 amount)",
  "event Refunded(bytes32 indexed campaignId, address indexed recipient, uint256 amount)",

  "event LootClaimed(uint64 indexed seasonId, address indexed player, uint256 amount, bool lastHitBonus)",
] as const

/** Reads used to fill in state the events do not carry. */
export const QUEST_ASC_READ_ABI = [
  "function QUEST_MANAGER() view returns (address)",
  "function rules(uint256 questId) view returns (uint8 actionType, address emitter, address token, uint256 minAmount, uint64 minSourceBlock, uint64 maxSourceBlock, bool playerMustMatch)",
] as const

export const QUEST_MANAGER_READ_ABI = [
  "function BADGE_NFT() view returns (address)",
  "function REWARD_VAULT() view returns (address)",
  // Field order matters: acceptedCount and completedCount sit before expiry. Reading it wrong
  // reports a timestamp as a chain key and answers nonsense without failing.
  "function getQuest(uint256 questId) view returns ((uint256 agentId,address agentController,uint8 category,address protocol,bytes32 parametersHash,string metadataURI,address rewardToken,uint256 rewardPerParticipant,uint256 badgeLevel,address assignedParticipant,uint32 acceptedCount,uint32 completedCount,uint64 expiry,uint8 status,uint64 createdAt,uint64 sourceChainKey,uint256 campaignId))",
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

export const LOOT_READ_ABI = [
  "function nextItemId() view returns (uint256)",
  "function itemOf(uint256 itemId) view returns (tuple(string name, uint8 slot, uint8 rarity, uint16 strength, uint16 agility, uint16 intellect, bool exists))",
  "function uri(uint256 itemId) view returns (string)",
  "function balanceOfBatch(address[] owners, uint256[] ids) view returns (uint256[])",
  "function pendingRaidLoot(uint64 seasonId, address player) view returns (bool claimable, uint256 shareBps, uint8 rarity)",
] as const

export const EQUIPMENT_READ_ABI = [
  "function loadout(uint256 heroTokenId) view returns (uint256[4])",
  "function bonusesOf(uint256 heroTokenId) view returns (uint16 strength, uint16 agility, uint16 intellect)",
] as const

export const ARENA_READ_ABI = [
  "function challenges(uint256 challengeId) view returns (address challenger, address opponent, uint256 stake, uint64 openedAtBlock, uint64 acceptedAtBlock, uint64 seedBlock, uint8 status, address winner)",
  "function seedOf(uint256 challengeId) view returns (bytes32)",
  "function SEED_DELAY_BLOCKS() view returns (uint64)",
  "function RESOLVE_WINDOW_BLOCKS() view returns (uint64)",
  "function nextChallengeId() view returns (uint256)",
  "function EXPIRY_BLOCKS() view returns (uint64)",
] as const

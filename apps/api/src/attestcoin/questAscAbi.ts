/** The slice of QuestASC the worker calls. */
export const QUEST_ASC_ABI = [
  "function submit((uint64 chainKey, uint64 blockHeight, bytes encodedTransaction, (bytes32 root, (bytes32 hash, bool isLeft)[] siblings) merkleProof, (bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) sourceTx, uint256 questIdHint) returns (uint256)",
  "function submitBatch((uint64 chainKey, uint64 blockHeight, bytes encodedTransaction, (bytes32 root, (bytes32 hash, bool isLeft)[] siblings) merkleProof, (bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof)[] sourceTxs, uint256[] questIdHints) returns (uint256)",
  "function claimedLog(bytes32 key) view returns (bool)",
  "function replayKey(uint64 chainKey, uint64 blockHeight, uint64 txIndex, uint64 logOrdinal) view returns (bytes32)",
  "function questPortal(uint64 chainKey) view returns (address)",
  "event QuestProofApplied(uint256 indexed questId, address indexed player, uint8 indexed actionType, bytes32 replayKey, uint64 sourceBlock, uint256 amount)",
  "event SourceTxVerified(uint64 indexed chainKey, uint64 indexed blockHeight, uint64 txIndex, uint256 handledLogs)",

  // Custom errors must be declared or ethers reports "unknown custom error" and a caller cannot
  // tell a replay from a broken rule. Classifying a failure is the whole point of the preflight.
  "error AlreadyClaimed(bytes32 key)",
  "error EmptyBatch()",
  "error BatchTooLarge(uint256 provided, uint256 maximum)",
  "error BatchRangeExceeded(uint64 lowestHeight, uint64 highestHeight, uint64 maximumSpan)",
  "error BatchLengthMismatch(uint256 sourceTxs, uint256 hints)",
  "error UnsupportedChainKey(uint64 chainKey)",
  "error ProofRejected(uint64 chainKey, uint64 blockHeight, bytes32 merkleRoot)",
  "error UnsupportedTransactionType(uint8 txType)",
  "error SourceTransactionReverted(uint64 chainKey, uint64 blockHeight, uint64 txIndex)",
  "error NothingRecognised(uint64 chainKey, uint64 blockHeight, uint64 txIndex)",
  "error OnlyQuestManager(address caller)",
  "error ActionNotYetSupported(uint8 actionType)",
  "error RuleAlreadyRegistered(uint256 questId)",
  "error NoRuleForQuest(uint256 questId)",
  "error QuestNotOpen(uint256 questId)",
  "error QuestHintMismatch(uint256 hinted, uint256 fromLog)",
  "error WrongSourceChain(uint256 questId, uint64 expected, uint64 provided)",
  "error WrongEmitter(address expected, address provided)",
  "error PlayerMismatch(address expected, address decoded)",
  "error ParticipantHasNotAccepted(uint256 questId, address player)",
  "error AmountBelowMinimum(uint256 required, uint256 provided)",
  "error WrongToken(address required, address provided)",
  "error SourceBlockTooEarly(uint64 provided, uint64 mustExceed)",
  "error SourceBlockTooLate(uint64 provided, uint64 maximum)",
  "error MalformedPortalLog()",
  "error InvalidAddress()",
] as const

export const QUEST_MANAGER_ABI = [
  "function createQuest((uint8 category, address protocol, bytes32 parametersHash, string metadataURI, uint256 rewardPerParticipant, uint64 expiry, uint256 badgeLevel, address participant, uint64 sourceChainKey, uint256 campaignId, (uint8 actionType, address emitter, address token, uint256 minAmount, uint64 minSourceBlock, uint64 maxSourceBlock, bool playerMustMatch) rule) params) returns (uint256)",
  "function acceptQuest(uint256 questId)",
  "function acceptedAtSourceHeight(uint256 questId, address participant) view returns (uint64)",
  "function hasAccepted(uint256 questId, address participant) view returns (bool)",
  "function questASC() view returns (address)",
  "event QuestCreated(uint256 indexed questId, uint256 indexed agentId, address indexed agentController, uint8 category, address protocol)",
  "event QuestAccepted(uint256 indexed questId, address indexed participant, uint64 sourceChainKey, uint64 acceptedAtSourceHeight)",
  "event QuestCompleted(uint256 indexed questId, address indexed participant, bytes32 indexed replayKey, bytes32 sourceTxHash)",
] as const

export const QUEST_PORTAL_ABI = [
  "function checkIn(uint256 questId) payable",
  "function deposit(uint256 questId, address token, uint256 amount)",
  "event QuestActionPerformed(uint256 indexed questId, address indexed player, uint8 indexed actionType, address token, uint256 amount)",
] as const

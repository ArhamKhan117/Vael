/**
 * Worker state, and the two places it can live.
 *
 * The state machine is the one in docs/SPEC.md section 6. A submission is written **before** any
 * network work happens, so a crash between observing a Sepolia log and proving it leaves a row
 * behind rather than losing the action entirely. Everything else is a transition on that row.
 */

export type SubmissionStatus =
  | "detected"
  | "attesting"
  | "proving"
  | "submitted"
  | "verified"
  | "failed"

export interface ProofSubmission {
  /** Stable id: one row per source transaction per quest. */
  id: string
  questIdOnChain: number
  participant: string
  sourceChainKey: number
  sourceTxHash: string
  sourceBlock: number
  actionType: number
  status: SubmissionStatus
  /** Log-scoped replay key, once the submission has been through QuestASC. */
  queryId?: string
  creditcoinTxHash?: string
  error?: string
  attempts: number
  createdAt: string
  updatedAt: string
}

/**
 * An indexed quest, as the chain describes it.
 *
 * The worker needs this to answer "which quest does this Sepolia log belong to?" for a third-party
 * protocol whose event knows nothing about Vael. Everything here is derived from Creditcoin events,
 * so the index is rebuildable and never a source of truth.
 */
export interface IndexedQuest {
  questId: number
  participant: string
  sourceChainKey: number
  actionType: number
  emitter: string
  token: string
  minAmount: string
  /** Set once QuestAccepted is seen, which is also the source-height anchor. */
  acceptedAtSourceHeight?: number
  accepted: boolean
  completed: boolean
  updatedAt: string
}

/** A hero, as the chain describes it. */
export interface IndexedHero {
  player: string
  tokenId: number
  level: number
  xp: string
  strength: number
  agility: number
  intellect: number
  streak: number
  updatedAt: string
}

/** One verified hit on the boss. */
export interface IndexedRaidHit {
  seasonId: number
  player: string
  damage: string
  hpRemaining: string
  actionType: number
  replayKey: string
  creditcoinBlock: number
  createdAt: string
}

/**
 * One action QuestASC verified and applied.
 *
 * This is the verified-action history: every row was written because the chain emitted
 * `QuestProofApplied`, which it only does after a Merkle proof and a continuity proof both check
 * out. `replayKey` is the log-scoped key QuestASC burns, so it is unique by construction and makes
 * a rescan idempotent for free.
 */
export interface IndexedAction {
  replayKey: string
  questId: number
  player: string
  actionType: number
  /** Height on the source chain the proved log came from. */
  sourceBlock: number
  /** Amount the adapter decoded, in the source token's own units. */
  amount: string
  creditcoinBlock: number
  createdAt: string
}

/**
 * One badge minted to an address.
 *
 * BadgeNFT is not enumerable, so an address's badges cannot be listed from the contract. They are
 * indexed from `BadgeMinted` instead. `rarityIsDerived` records where the rarity came from: the
 * deployed v2 does not store one, so it is computed from the badge level by the published rule,
 * and v3 carries it on the event. The flag exists so the UI never claims the chain said something
 * it did not.
 */
export interface IndexedBadge {
  tokenId: number
  player: string
  questId: number
  badgeLevel: number
  /** 0 Common through 4 Legendary. */
  rarity: number
  rarityIsDerived: boolean
  creditcoinBlock: number
  createdAt: string
}

/** One VAEL payout released by the vault when QuestASC completed a quest. */
export interface IndexedReward {
  /** `{creditcoinTxHash}:{questId}` - one release per quest per transaction. */
  id: string
  questId: number
  recipient: string
  amount: string
  creditcoinBlock: number
  creditcoinTxHash: string
  createdAt: string
}

/**
 * How far one address has got through one academy module.
 *
 * Nothing here gates anything on chain. Reading a lesson and passing a quiz are conveniences the
 * player would otherwise track on paper; the badge still comes from a quest QuestASC verified, so
 * a wiped or forged progress row changes what the page displays and nothing else.
 */
export interface AcademyModuleProgress {
  /** Indices of the lesson cards marked read. */
  lessonsRead: number[]
  quizScore: number
  quizPassed: boolean
  updatedAt: string
}

export interface AcademyProgress {
  player: string
  modules: Record<string, AcademyModuleProgress>
  updatedAt: string
}

/** One arena duel, updated as it moves through its lifecycle. */
export interface IndexedChallenge {
  challengeId: number
  challenger: string
  opponent: string
  stake: string
  status: "open" | "accepted" | "resolved" | "drawn" | "expired" | "cancelled" | "voided"
  winner?: string
  payout?: string
  burned?: string
  seed?: string
  /** The round log, 0x-prefixed hex, three bytes per swing. A client replays the duel from it. */
  rounds?: string
  openedAtBlock: number
  acceptedAtBlock?: number
  /** The block whose hash seeds the duel, committed at acceptance. */
  seedBlock?: number
  resolvedAtBlock?: number
  updatedAt: string
}

/** One item minted, from a raid claim or an arena win. */
export interface IndexedDrop {
  /** `{creditcoinTxHash}:{logIndex}` - a player can win two items in one transaction. */
  id: string
  player: string
  itemId: number
  rarity: number
  /** "raid" or "arena". */
  reason: string
  /** Set for a raid drop: the season and the share of damage that earned it. */
  seasonId?: number
  shareBps?: number
  creditcoinBlock: number
  creditcoinTxHash: string
  createdAt: string
}

/** One equip or unequip. */
export interface IndexedEquipmentEvent {
  id: string
  heroTokenId: number
  slot: number
  itemId: number
  owner: string
  equipped: boolean
  creditcoinBlock: number
  createdAt: string
}

/** One marketplace listing, updated as it is sold or cancelled. */
export interface IndexedListing {
  listingId: number
  seller: string
  itemId: number
  amount: number
  price: string
  status: "active" | "sold" | "cancelled"
  buyer?: string
  fee?: string
  listedAtBlock: number
  closedAtBlock?: number
  updatedAt: string
}

export interface WorkerCursor {
  chainKey: number
  emitter: string
  lastBlock: number
  updatedAt: string
}

/**
 * Everything the worker needs to survive a restart.
 *
 * Two implementations: a JSON file for a single operator with no infrastructure, and Supabase for
 * a deployed worker. The interface is deliberately small so a third one stays cheap.
 */
/** How a quest reaches a player. Campaign comes from the chain, daily and weekly from metadata. */
export type QuestCadence = "daily" | "weekly" | "campaign" | "open"

/**
 * The display half of an indexed quest.
 *
 * `IndexedQuest` above carries what the worker needs to match a source log to a quest. This
 * carries what a page needs to render one, and every field is read back off QuestManager after a
 * `QuestCreated`, so nothing here is a claim the chain would not make itself. `title` and
 * `description` come from the metadata document the quest points at, which is the one part a
 * pinning service rather than Creditcoin holds.
 */
export interface QuestCatalogFields {
  /**
   * The address the quest is assigned to, straight off the struct.
   *
   * QuestManager emits RuleRegistered before QuestCreated, so the worker's half of the row is
   * written first with nothing to name the participant. The chain has known it since creation.
   */
  assignedParticipant: string
  category: number
  protocol: string
  metadataURI: string
  rewardToken: string
  rewardAmount: string
  badgeLevel: number
  status: number
  expiry: number
  createdAtChain: number
  /** uint256 as a decimal string. "0" means RewardVault pays; anything else names an escrow pool. */
  campaignId: string
  acceptedCount: number
  completedCount: number
  title: string
  description: string
  cadence: QuestCadence
  creditcoinBlock: number
  /** The pinned banner as an `ipfs://` URI, copied out of the metadata document at index time. */
  image?: string
}

/**
 * An indexed quest with its catalog half attached.
 *
 * `catalogued` is false for a row the worker wrote from a rule alone: it is matchable but has
 * never been read back off QuestManager, so it must not be shown as if it had.
 */
export type CataloguedQuest = IndexedQuest & Partial<QuestCatalogFields> & { catalogued: boolean }

/**
 * One campaign pool, as CampaignEscrow describes it.
 *
 * The escrow keys pools by bytes32 and holds no name, so the totals come from its events and the
 * label comes from the partner publish that created the campaign's quests. A pool funded any other
 * way still appears; it shows its key.
 */
export interface IndexedCampaign {
  campaignKey: string
  campaignId?: string
  title?: string
  partner: string
  deposited: string
  released: string
  refunded: string
  firstSeenBlock: number
  /** Position of the last escrow log folded into the totals, so a rescan cannot double-count. */
  lastBlock: number
  lastLogIndex: number
  updatedAt: string
}

export interface WorkerStore {
  readonly kind: "file" | "supabase"

  init(): Promise<void>

  /** Insert if absent, returning the existing row otherwise. Keyed by chain, tx, and quest. */
  upsertSubmission(
    submission: Omit<ProofSubmission, "id" | "createdAt" | "updatedAt" | "attempts"> &
      Partial<Pick<ProofSubmission, "attempts">>
  ): Promise<ProofSubmission>

  updateSubmission(id: string, patch: Partial<ProofSubmission>): Promise<ProofSubmission>

  /** Rows that still have work to do, oldest first. */
  pendingSubmissions(): Promise<ProofSubmission[]>

  getSubmission(id: string): Promise<ProofSubmission | undefined>

  allSubmissions(): Promise<ProofSubmission[]>

  getCursor(chainKey: number, emitter: string): Promise<WorkerCursor | undefined>

  setCursor(chainKey: number, emitter: string, lastBlock: number): Promise<void>

  // ---------------------------------------------------------------- index

  upsertQuest(quest: IndexedQuest): Promise<void>

  getQuest(questId: number): Promise<IndexedQuest | undefined>

  /**
   * Quests this player has accepted and not completed, most recently accepted first.
   *
   * This is how a third-party log is resolved to a quest: a Uniswap `Swap` cannot name a quest, so
   * the worker asks which of the player's open quests that action could satisfy.
   */
  openQuestsFor(participant: string): Promise<IndexedQuest[]>

  allQuests(): Promise<IndexedQuest[]>

  /** Attach the display half of a quest, read back off QuestManager after a QuestCreated. */
  upsertQuestCatalog(questId: number, fields: QuestCatalogFields): Promise<void>

  /** Quests that have been read back off the chain, newest first. */
  questCatalog(filter?: {
    participant?: string
    cadence?: QuestCadence
    campaignId?: string
  }): Promise<CataloguedQuest[]>

  /** Merge what one escrow event says about a pool into its row. */
  upsertCampaign(
    campaign: Pick<IndexedCampaign, "campaignKey"> & Partial<Omit<IndexedCampaign, "campaignKey">>
  ): Promise<void>

  campaigns(): Promise<IndexedCampaign[]>

  getCampaign(campaignKey: string): Promise<IndexedCampaign | undefined>

  upsertHero(hero: IndexedHero): Promise<void>

  getHero(player: string): Promise<IndexedHero | undefined>

  allHeroes(): Promise<IndexedHero[]>

  addRaidHit(hit: IndexedRaidHit): Promise<void>

  raidHits(seasonId: number): Promise<IndexedRaidHit[]>

  addAction(action: IndexedAction): Promise<void>

  /** Newest first. Omit `player` for every action across every player. */
  actions(player?: string): Promise<IndexedAction[]>

  addReward(reward: IndexedReward): Promise<void>

  allRewards(): Promise<IndexedReward[]>

  addBadge(badge: IndexedBadge): Promise<void>

  /** Newest first. Omit `player` for every badge. */
  badges(player?: string): Promise<IndexedBadge[]>

  upsertChallenge(challenge: IndexedChallenge): Promise<void>

  getChallenge(challengeId: number): Promise<IndexedChallenge | undefined>

  /** Newest first. `address` matches either side of the duel. */
  challenges(filter?: { address?: string; status?: string }): Promise<IndexedChallenge[]>

  addDrop(drop: IndexedDrop): Promise<void>

  drops(player?: string): Promise<IndexedDrop[]>

  addEquipmentEvent(event: IndexedEquipmentEvent): Promise<void>

  equipmentEvents(heroTokenId?: number): Promise<IndexedEquipmentEvent[]>

  upsertListing(listing: IndexedListing): Promise<void>

  getListing(listingId: number): Promise<IndexedListing | undefined>

  listings(filter?: { status?: string; seller?: string }): Promise<IndexedListing[]>

  getAcademyProgress(player: string): Promise<AcademyProgress | undefined>

  saveAcademyProgress(progress: AcademyProgress): Promise<void>
}

/** Statuses that still need the worker to do something. */
export const PENDING_STATUSES: SubmissionStatus[] = [
  "detected",
  "attesting",
  "proving",
  "submitted",
]

export function submissionId(chainKey: number, sourceTxHash: string, questId: number): string {
  return `${chainKey}:${sourceTxHash.toLowerCase()}:${questId}`
}

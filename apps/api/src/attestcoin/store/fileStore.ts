import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import {
  AcademyProgress,
  IndexedAction,
  IndexedBadge,
  IndexedChallenge,
  IndexedDrop,
  IndexedEquipmentEvent,
  IndexedListing,
  IndexedHero,
  IndexedQuest,
  IndexedRaidHit,
  IndexedReward,
  PENDING_STATUSES,
  ProofSubmission,
  WorkerCursor,
  WorkerStore,
  submissionId,
} from "./types"

interface FileShape {
  submissions: Record<string, ProofSubmission>
  cursors: Record<string, WorkerCursor>
  quests: Record<string, IndexedQuest>
  heroes: Record<string, IndexedHero>
  raidHits: IndexedRaidHit[]
  actions: Record<string, IndexedAction>
  rewards: Record<string, IndexedReward>
  academyProgress: Record<string, AcademyProgress>
  badges: Record<string, IndexedBadge>
  challenges: Record<string, IndexedChallenge>
  drops: Record<string, IndexedDrop>
  equipmentEvents: Record<string, IndexedEquipmentEvent>
  listings: Record<string, IndexedListing>
}

/** A factory, not a shared constant: two stores must never alias the same maps. */
function emptyShape(): FileShape {
  return {
    submissions: {},
    cursors: {},
    quests: {},
    heroes: {},
    raidHits: [],
    actions: {},
    rewards: {},
    academyProgress: {},
    badges: {},
    challenges: {},
    drops: {},
    equipmentEvents: {},
    listings: {},
  }
}

/**
 * JSON file store, for running the worker with no infrastructure.
 *
 * Writes go to a temporary file and are renamed into place, so a crash mid-write cannot leave a
 * half-written state file that the next start refuses to parse. That matters more here than
 * performance: the whole point of this store is surviving a restart.
 */
export class FileWorkerStore implements WorkerStore {
  readonly kind = "file" as const

  private readonly path: string
  private data: FileShape = emptyShape()

  constructor(directory: string) {
    this.path = join(directory, "worker-state.json")
  }

  async init(): Promise<void> {
    mkdirSync(dirname(this.path), { recursive: true })
    try {
      this.data = JSON.parse(readFileSync(this.path, "utf8")) as FileShape
      // Older state files predate the index, so fill in whatever is missing rather than
      // refusing to start: chain state is the source of truth and the index rebuilds itself.
      if (!this.data.submissions) this.data.submissions = {}
      if (!this.data.cursors) this.data.cursors = {}
      if (!this.data.quests) this.data.quests = {}
      if (!this.data.heroes) this.data.heroes = {}
      if (!this.data.raidHits) this.data.raidHits = []
      if (!this.data.actions) this.data.actions = {}
      if (!this.data.rewards) this.data.rewards = {}
      if (!this.data.academyProgress) this.data.academyProgress = {}
      if (!this.data.badges) this.data.badges = {}
      if (!this.data.challenges) this.data.challenges = {}
      if (!this.data.drops) this.data.drops = {}
      if (!this.data.equipmentEvents) this.data.equipmentEvents = {}
      if (!this.data.listings) this.data.listings = {}
    } catch {
      // No file yet, or an unreadable one. Starting from empty is correct: chain state is the
      // source of truth and the cursors will simply rescan.
      this.data = emptyShape()
      this.flush()
    }
  }

  private flush() {
    const tmp = `${this.path}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2) + "\n")
    renameSync(tmp, this.path)
  }

  async upsertSubmission(
    input: Omit<ProofSubmission, "id" | "createdAt" | "updatedAt" | "attempts"> &
      Partial<Pick<ProofSubmission, "attempts">>
  ): Promise<ProofSubmission> {
    const id = submissionId(input.sourceChainKey, input.sourceTxHash, input.questIdOnChain)
    const existing = this.data.submissions[id]
    if (existing) return existing

    const now = new Date().toISOString()
    const row: ProofSubmission = {
      ...input,
      id,
      attempts: input.attempts ?? 0,
      createdAt: now,
      updatedAt: now,
    }
    this.data.submissions[id] = row
    this.flush()
    return row
  }

  async updateSubmission(id: string, patch: Partial<ProofSubmission>): Promise<ProofSubmission> {
    const existing = this.data.submissions[id]
    if (!existing) throw new Error(`submission ${id} not found`)
    const row: ProofSubmission = { ...existing, ...patch, updatedAt: new Date().toISOString() }
    this.data.submissions[id] = row
    this.flush()
    return row
  }

  async pendingSubmissions(): Promise<ProofSubmission[]> {
    return Object.values(this.data.submissions)
      .filter((row) => PENDING_STATUSES.includes(row.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async getSubmission(id: string): Promise<ProofSubmission | undefined> {
    return this.data.submissions[id]
  }

  async allSubmissions(): Promise<ProofSubmission[]> {
    return Object.values(this.data.submissions).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    )
  }

  async getCursor(chainKey: number, emitter: string): Promise<WorkerCursor | undefined> {
    return this.data.cursors[`${chainKey}:${emitter.toLowerCase()}`]
  }

  async setCursor(chainKey: number, emitter: string, lastBlock: number): Promise<void> {
    this.data.cursors[`${chainKey}:${emitter.toLowerCase()}`] = {
      chainKey,
      emitter: emitter.toLowerCase(),
      lastBlock,
      updatedAt: new Date().toISOString(),
    }
    this.flush()
  }

  // ---------------------------------------------------------------- index

  async upsertQuest(quest: IndexedQuest): Promise<void> {
    const key = String(quest.questId)
    const existing = this.data.quests[key]
    // Merge rather than replace: QuestCreated carries the rule, QuestAccepted the anchor, and
    // QuestCompleted only the flag. Each arrives as its own event.
    this.data.quests[key] = { ...(existing ?? {}), ...quest } as IndexedQuest
    this.flush()
  }

  async getQuest(questId: number): Promise<IndexedQuest | undefined> {
    return this.data.quests[String(questId)]
  }

  async openQuestsFor(participant: string): Promise<IndexedQuest[]> {
    const who = participant.toLowerCase()
    return Object.values(this.data.quests)
      .filter((q) => q.participant.toLowerCase() === who && q.accepted && !q.completed)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async allQuests(): Promise<IndexedQuest[]> {
    return Object.values(this.data.quests)
  }

  async upsertHero(hero: IndexedHero): Promise<void> {
    this.data.heroes[hero.player.toLowerCase()] = hero
    this.flush()
  }

  async getHero(player: string): Promise<IndexedHero | undefined> {
    return this.data.heroes[player.toLowerCase()]
  }

  async allHeroes(): Promise<IndexedHero[]> {
    return Object.values(this.data.heroes)
  }

  async addRaidHit(hit: IndexedRaidHit): Promise<void> {
    const seen = this.data.raidHits.some(
      (h) => h.replayKey === hit.replayKey && h.seasonId === hit.seasonId
    )
    if (seen) return
    this.data.raidHits.push(hit)
    this.flush()
  }

  async raidHits(seasonId: number): Promise<IndexedRaidHit[]> {
    return this.data.raidHits
      .filter((h) => h.seasonId === seasonId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async addAction(action: IndexedAction): Promise<void> {
    if (this.data.actions[action.replayKey]) return
    this.data.actions[action.replayKey] = action
    this.flush()
  }

  async actions(player?: string): Promise<IndexedAction[]> {
    const wanted = player?.toLowerCase()
    return Object.values(this.data.actions)
      .filter((a) => !wanted || a.player === wanted)
      .sort((a, b) => b.creditcoinBlock - a.creditcoinBlock)
  }

  async addReward(reward: IndexedReward): Promise<void> {
    if (this.data.rewards[reward.id]) return
    this.data.rewards[reward.id] = reward
    this.flush()
  }

  async allRewards(): Promise<IndexedReward[]> {
    return Object.values(this.data.rewards)
  }

  async addBadge(badge: IndexedBadge): Promise<void> {
    const key = String(badge.tokenId)
    if (this.data.badges[key]) return
    this.data.badges[key] = badge
    this.flush()
  }

  async badges(player?: string): Promise<IndexedBadge[]> {
    const wanted = player?.toLowerCase()
    return Object.values(this.data.badges)
      .filter((badge) => !wanted || badge.player === wanted)
      .sort((a, b) => b.tokenId - a.tokenId)
  }

  async upsertChallenge(challenge: IndexedChallenge): Promise<void> {
    this.data.challenges[String(challenge.challengeId)] = challenge
    this.flush()
  }

  async getChallenge(challengeId: number): Promise<IndexedChallenge | undefined> {
    return this.data.challenges[String(challengeId)]
  }

  async challenges(filter?: { address?: string; status?: string }): Promise<IndexedChallenge[]> {
    const who = filter?.address?.toLowerCase()
    return Object.values(this.data.challenges)
      .filter((c) => !filter?.status || c.status === filter.status)
      .filter((c) => !who || c.challenger === who || c.opponent === who)
      .sort((a, b) => b.challengeId - a.challengeId)
  }

  async addDrop(drop: IndexedDrop): Promise<void> {
    if (this.data.drops[drop.id]) return
    this.data.drops[drop.id] = drop
    this.flush()
  }

  async drops(player?: string): Promise<IndexedDrop[]> {
    const who = player?.toLowerCase()
    return Object.values(this.data.drops)
      .filter((d) => !who || d.player === who)
      .sort((a, b) => b.creditcoinBlock - a.creditcoinBlock)
  }

  async addEquipmentEvent(event: IndexedEquipmentEvent): Promise<void> {
    if (this.data.equipmentEvents[event.id]) return
    this.data.equipmentEvents[event.id] = event
    this.flush()
  }

  async equipmentEvents(heroTokenId?: number): Promise<IndexedEquipmentEvent[]> {
    return Object.values(this.data.equipmentEvents)
      .filter((e) => heroTokenId === undefined || e.heroTokenId === heroTokenId)
      .sort((a, b) => b.creditcoinBlock - a.creditcoinBlock)
  }

  async upsertListing(listing: IndexedListing): Promise<void> {
    this.data.listings[String(listing.listingId)] = listing
    this.flush()
  }

  async getListing(listingId: number): Promise<IndexedListing | undefined> {
    return this.data.listings[String(listingId)]
  }

  async listings(filter?: { status?: string; seller?: string }): Promise<IndexedListing[]> {
    const who = filter?.seller?.toLowerCase()
    return Object.values(this.data.listings)
      .filter((l) => !filter?.status || l.status === filter.status)
      .filter((l) => !who || l.seller === who)
      .sort((a, b) => b.listingId - a.listingId)
  }

  async getAcademyProgress(player: string): Promise<AcademyProgress | undefined> {
    return this.data.academyProgress[player.toLowerCase()]
  }

  async saveAcademyProgress(progress: AcademyProgress): Promise<void> {
    this.data.academyProgress[progress.player.toLowerCase()] = progress
    this.flush()
  }
}

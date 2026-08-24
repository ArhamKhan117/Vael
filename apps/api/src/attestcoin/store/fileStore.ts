import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import {
  IndexedHero,
  IndexedQuest,
  IndexedRaidHit,
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
  private data: FileShape = { submissions: {}, cursors: {}, quests: {}, heroes: {}, raidHits: [] }

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
    } catch {
      // No file yet, or an unreadable one. Starting from empty is correct: chain state is the
      // source of truth and the cursors will simply rescan.
      this.data = { submissions: {}, cursors: {}, quests: {}, heroes: {}, raidHits: [] }
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
}

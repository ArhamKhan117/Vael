import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { FileWorkerStore } from "../fileStore"
import { submissionId } from "../types"

/**
 * The file store is what makes a restart safe when there is no Supabase, so these tests are about
 * survival: does a second instance reading the same file see what the first one wrote.
 */
describe("FileWorkerStore", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vael-store-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const sample = {
    questIdOnChain: 6,
    participant: "0x017dfb929979ac1b7e1a080c88db56bee45846d2",
    sourceChainKey: 1,
    sourceTxHash: "0xdeffdb9e6fd23407cd6fe100c70604184f8b2e8fdfb0b29a5f4462ce6bf389ba",
    sourceBlock: 11668734,
    actionType: 0,
    status: "detected" as const,
  }

  it("survives a restart with the row in the stage it was left", async () => {
    const first = new FileWorkerStore(dir)
    await first.init()
    const row = await first.upsertSubmission(sample)
    await first.updateSubmission(row.id, { status: "attesting" })
    await first.setCursor(1, "all", 11668741)

    // A completely separate instance, as a restarted process would be.
    const second = new FileWorkerStore(dir)
    await second.init()

    const pending = await second.pendingSubmissions()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.status).toBe("attesting")
    expect(pending[0]?.sourceBlock).toBe(11668734)
    expect((await second.getCursor(1, "all"))?.lastBlock).toBe(11668741)
  })

  it("is idempotent per chain, transaction, and quest", async () => {
    const store = new FileWorkerStore(dir)
    await store.init()
    const a = await store.upsertSubmission(sample)
    const b = await store.upsertSubmission({ ...sample, status: "proving" })

    expect(b.id).toBe(a.id)
    expect(b.status).toBe("detected")
    expect(await store.allSubmissions()).toHaveLength(1)
  })

  it("keys the same transaction under different quests separately", async () => {
    const store = new FileWorkerStore(dir)
    await store.init()
    await store.upsertSubmission(sample)
    await store.upsertSubmission({ ...sample, questIdOnChain: 7 })
    expect(await store.allSubmissions()).toHaveLength(2)
  })

  it("drops verified and failed rows out of the pending set", async () => {
    const store = new FileWorkerStore(dir)
    await store.init()
    const row = await store.upsertSubmission(sample)
    await store.updateSubmission(row.id, { status: "verified" })
    expect(await store.pendingSubmissions()).toHaveLength(0)

    const other = await store.upsertSubmission({ ...sample, questIdOnChain: 8 })
    await store.updateSubmission(other.id, { status: "failed" })
    expect(await store.pendingSubmissions()).toHaveLength(0)
  })

  it("starts clean rather than throwing when the state file is corrupt", async () => {
    const store = new FileWorkerStore(dir)
    await store.init()
    await store.upsertSubmission(sample)

    writeFileSync(join(dir, "worker-state.json"), "{ not json")

    const recovered = new FileWorkerStore(dir)
    await recovered.init()
    // Chain state is the source of truth, so an unreadable cache must not stop the worker.
    expect(await recovered.allSubmissions()).toHaveLength(0)
  })

  it("builds a stable id from chain, transaction, and quest", () => {
    expect(submissionId(1, "0xABC", 6)).toBe(submissionId(1, "0xabc", 6))
    expect(submissionId(1, "0xabc", 6)).not.toBe(submissionId(3, "0xabc", 6))
  })
})

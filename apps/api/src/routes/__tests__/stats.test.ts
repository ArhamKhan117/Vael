import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import express from "express"

import { FileWorkerStore } from "../../attestcoin/store/fileStore"
import { testApp } from "../../__tests__/helpers"

const dir = mkdtempSync(join(tmpdir(), "vael-stats-"))
const store = new FileWorkerStore(dir)

jest.mock("../../attestcoin/store", () => ({
  createWorkerStore: () => store,
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { gameRouter } = require("../game")

const app = express()
app.use(express.json())
app.use("/", gameRouter)

const ALICE = "0x017dfb929979ac1b7e1a080c88db56bee45846d2"
const BOB = "0x62d937dc3410c9c79078a521da254e6fd53936f1"

// The route reads RAID_BOSS_ADDRESS per request, and .env.test supplies a real one. Unsetting it
// keeps the suite off the network and pins the honest zero state, which is the case worth testing.
let raidAddress: string | undefined

beforeAll(() => {
  // Captured here, not at module scope: .env.test is injected after this file is loaded.
  raidAddress = process.env.RAID_BOSS_ADDRESS
  delete process.env.RAID_BOSS_ADDRESS
})

afterAll(() => {
  if (raidAddress) process.env.RAID_BOSS_ADDRESS = raidAddress
  rmSync(dir, { recursive: true, force: true })
})

/**
 * These numbers appear on the landing page and the leaderboard, so the thing worth testing is that
 * they are sums of what the indexer stored and nothing else. An empty network must read zero, not
 * a placeholder.
 */
describe("GET /stats", () => {
  it("reports zeros before anything has happened", async () => {
    const response = await testApp(app).get("/stats")

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      heroesMinted: 0,
      totalHeroXp: "0",
      proofsVerified: 0,
      vaelReleased: "0",
      season: { seasonId: 0, active: false, totalDamage: "0" },
    })
  })

  it("sums hero XP, counts heroes, counts proofs, and sums VAEL released", async () => {
    await store.init()
    await store.upsertHero({
      player: ALICE,
      tokenId: 1,
      level: 3,
      xp: "120",
      strength: 4,
      agility: 1,
      intellect: 0,
      streak: 2,
      updatedAt: new Date().toISOString(),
    })
    await store.upsertHero({
      player: BOB,
      tokenId: 2,
      level: 1,
      xp: "80",
      strength: 0,
      agility: 2,
      intellect: 1,
      streak: 0,
      updatedAt: new Date().toISOString(),
    })
    for (const key of ["0xaa", "0xbb", "0xcc"]) {
      await store.addAction({
        replayKey: key,
        questId: 1,
        player: ALICE,
        actionType: 0,
        sourceBlock: 11668662,
        amount: "1000",
        creditcoinBlock: 100,
        createdAt: new Date().toISOString(),
      })
    }
    // Two payouts, one of them larger than Number.MAX_SAFE_INTEGER, so the sum has to stay bigint.
    await store.addReward({
      id: "0xtx1:1",
      questId: 1,
      recipient: ALICE,
      amount: "100000000000000000000",
      creditcoinBlock: 100,
      creditcoinTxHash: "0xtx1",
      createdAt: new Date().toISOString(),
    })
    await store.addReward({
      id: "0xtx2:2",
      questId: 2,
      recipient: BOB,
      amount: "50000000000000000000",
      creditcoinBlock: 101,
      creditcoinTxHash: "0xtx2",
      createdAt: new Date().toISOString(),
    })

    const response = await testApp(app).get("/stats")

    expect(response.body.heroesMinted).toBe(2)
    expect(response.body.totalHeroXp).toBe("200")
    expect(response.body.proofsVerified).toBe(3)
    expect(response.body.vaelReleased).toBe("150000000000000000000")
  })

  it("does not double-count a replay key the indexer sees twice", async () => {
    await store.addAction({
      replayKey: "0xaa",
      questId: 1,
      player: ALICE,
      actionType: 0,
      sourceBlock: 11668662,
      amount: "1000",
      creditcoinBlock: 100,
      createdAt: new Date().toISOString(),
    })

    const response = await testApp(app).get("/stats")
    expect(response.body.proofsVerified).toBe(3)
  })
})

describe("GET /actions/:address", () => {
  it("rejects a bad address", async () => {
    const response = await testApp(app).get("/actions/nope")
    expect(response.status).toBe(400)
  })

  it("returns only that address's actions, with the VAEL its quest released", async () => {
    const response = await testApp(app).get(`/actions/${ALICE}`)

    expect(response.status).toBe(200)
    expect(response.body.actions).toHaveLength(3)
    expect(response.body.actions.every((a: { player: string }) => a.player === ALICE)).toBe(true)
    expect(response.body.actions[0].vaelReleased).toBe("100000000000000000000")

    const bob = await testApp(app).get(`/actions/${BOB}`)
    expect(bob.body.actions).toHaveLength(0)
  })
})

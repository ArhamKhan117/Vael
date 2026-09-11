import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import express from "express"

import { FileWorkerStore } from "../../attestcoin/store/fileStore"
import type { QuestCatalogFields } from "../../attestcoin/store/types"
import { testApp } from "../../__tests__/helpers"

const dir = mkdtempSync(join(tmpdir(), "vael-catalog-"))
const store = new FileWorkerStore(dir)

jest.mock("../../attestcoin/store", () => ({
  createWorkerStore: () => store,
}))

// No escrow configured, so every pool's balance reads as zero and its status follows from what
// the index recorded: refunded if anything was refunded, drained otherwise. No allowlist either,
// so the protocol chip is never claimed. Both are the failing-closed paths, and they are the ones
// a unit test can reach without a chain.
delete process.env.CAMPAIGN_ESCROW_ADDRESS
delete process.env.QUEST_ASC_ADDRESS

// Imported after the mock so the router picks up the temp-directory store.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { catalogRouter } = require("../catalog")

const app = express()
app.use(express.json())
app.use("/", catalogRouter)

const PLAYER = "0x017dfb929979ac1b7e1a080c88db56bee45846d2"
const PARTNER = "0xad96b40adb0ebf883798abe3caa684a255e01ebd"

/** On-chain campaign ids, as the decimal strings the index stores, and the escrow keys they map to. */
const POOL_A = "1"
const POOL_B = "2"
const keyOf = (id: string) => `0x${BigInt(id).toString(16).padStart(64, "0")}`

const NOW = Math.floor(Date.now() / 1000)

function catalogue(overrides: Partial<QuestCatalogFields> = {}): QuestCatalogFields {
  return {
    assignedParticipant: PLAYER,
    category: 0,
    protocol: "0x0000000000000000000000000000000000000000",
    metadataURI: "ipfs://QmTest",
    rewardToken: "0x0000000000000000000000000000000000000000",
    rewardAmount: "1000000000000000000",
    badgeLevel: 1,
    status: 1,
    expiry: 0,
    createdAtChain: NOW - 3600,
    campaignId: "0",
    acceptedCount: 0,
    completedCount: 0,
    title: "",
    description: "",
    cadence: "open",
    creditcoinBlock: 1,
    ...overrides,
  }
}

async function quest(questId: number, fields: Partial<QuestCatalogFields> = {}) {
  await store.upsertQuest({
    questId,
    participant: PLAYER,
    sourceChainKey: 1,
    actionType: 0,
    emitter: "0x62d937dc3410c9c79078a521da254e6fd53936f1",
    token: "0x0000000000000000000000000000000000000000",
    minAmount: "1",
    accepted: false,
    completed: false,
    updatedAt: new Date().toISOString(),
  })
  await store.upsertQuestCatalog(questId, catalogue(fields))
}

beforeAll(async () => {
  await store.init()
  // Pool A was refunded in full; pool B still stands (no balance readable here, so "drained").
  await store.upsertCampaign({
    campaignKey: keyOf(POOL_A),
    partner: PARTNER,
    deposited: "100",
    released: "0",
    refunded: "100",
    firstSeenBlock: 1,
  })
  await store.upsertCampaign({
    campaignKey: keyOf(POOL_B),
    partner: PARTNER,
    deposited: "100",
    released: "50",
    refunded: "0",
    firstSeenBlock: 2,
  })

  await quest(1, { title: "Never expires" })
  await quest(2, { title: "Long gone", expiry: NOW - 60 })
  await quest(3, { title: "Still open", expiry: NOW + 86_400 })
  await quest(4, { title: "Paid by a refunded pool", campaignId: POOL_A, cadence: "campaign" })
  await quest(5, { title: "Earliest in pool B", campaignId: POOL_B, cadence: "campaign", image: "ipfs://QmQuestB5" })
  await quest(6, { title: "Later in pool B", campaignId: POOL_B, cadence: "campaign" })
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe("GET /quests", () => {
  it("marks a quest expired only when its expiry has passed", async () => {
    const response = await testApp(app).get("/quests")
    expect(response.status).toBe(200)
    const byId = new Map(response.body.quests.map((q: { questId: number }) => [q.questId, q]))
    expect(byId.get(1)).toMatchObject({ expiry: 0, expired: false })
    expect(byId.get(2)).toMatchObject({ expired: true })
    expect(byId.get(3)).toMatchObject({ expired: false })
  })

  it("says which pool a campaign quest draws on and whether it can still pay", async () => {
    const response = await testApp(app).get("/quests")
    const byId = new Map(response.body.quests.map((q: { questId: number }) => [q.questId, q]))
    expect(byId.get(1)).toMatchObject({ campaignKey: null, campaignStatus: null })
    expect(byId.get(4)).toMatchObject({ campaignKey: keyOf(POOL_A), campaignStatus: "refunded" })
    expect(byId.get(5)).toMatchObject({ campaignKey: keyOf(POOL_B), campaignStatus: "drained" })
  })
})

describe("GET /campaigns", () => {
  it("names a pool after its earliest quest when it has no document of its own", async () => {
    const response = await testApp(app).get("/campaigns")
    expect(response.status).toBe(200)
    const poolB = response.body.campaigns.find((c: { campaignKey: string }) => c.campaignKey === keyOf(POOL_B))
    // The lowest quest id, which is the quest the pool was published with.
    expect(poolB.title).toBe("Earliest in pool B")
    expect(poolB.image).toBe("ipfs://QmQuestB5")
    expect(poolB.questCount).toBe(2)
  })

  it("prefers the pool's own pinned document over its quests", async () => {
    await store.upsertCampaign({
      campaignKey: keyOf(POOL_B),
      campaignId: "pool-b",
      title: "Pool B, by name",
      description: "What the partner wrote about the pool.",
      image: "ipfs://QmPoolB",
      metadataUri: "ipfs://QmPoolBDocument",
    })
    const response = await testApp(app).get("/campaigns")
    const poolB = response.body.campaigns.find((c: { campaignKey: string }) => c.campaignKey === keyOf(POOL_B))
    expect(poolB).toMatchObject({
      title: "Pool B, by name",
      description: "What the partner wrote about the pool.",
      image: "ipfs://QmPoolB",
      metadataUri: "ipfs://QmPoolBDocument",
      campaignId: "pool-b",
    })
    // Naming a pool never touches what the escrow events accumulated.
    expect(poolB.released).toBe("50")
  })

  it("reports a refunded pool as refunded and leaves it its key when it has no quests", async () => {
    await store.upsertCampaign({
      campaignKey: keyOf("3"),
      partner: PARTNER,
      deposited: "10",
      released: "0",
      refunded: "10",
      firstSeenBlock: 3,
    })
    const response = await testApp(app).get("/campaigns")
    const byKey = new Map(response.body.campaigns.map((c: { campaignKey: string }) => [c.campaignKey, c]))
    expect(byKey.get(keyOf(POOL_A))).toMatchObject({ status: "refunded", title: "Paid by a refunded pool" })
    expect(byKey.get(keyOf("3"))).toMatchObject({ status: "refunded", questCount: 0 })
    expect((byKey.get(keyOf("3")) as { title?: string }).title).toBeUndefined()
  })

  it("marks the quests of a refunded pool on that pool's own page", async () => {
    const response = await testApp(app).get(`/campaigns/${keyOf(POOL_A)}`)
    expect(response.status).toBe(200)
    expect(response.body.campaign.status).toBe("refunded")
    expect(response.body.quests).toHaveLength(1)
    expect(response.body.quests[0]).toMatchObject({ questId: 4, campaignStatus: "refunded" })
  })
})

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import express from "express"

import { FileWorkerStore } from "../../attestcoin/store/fileStore"
import { testApp } from "../../__tests__/helpers"

const dir = mkdtempSync(join(tmpdir(), "vael-academy-"))
const store = new FileWorkerStore(dir)

jest.mock("../../attestcoin/store", () => ({
  createWorkerStore: () => store,
}))

// Imported after the mock so the router picks up the temp-directory store.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { academyRouter } = require("../academy")

const app = express()
app.use(express.json())
app.use("/academy", academyRouter)

const ADDRESS = "0x017dfb929979ac1b7e1a080c88db56bee45846d2"

afterAll(() => rmSync(dir, { recursive: true, force: true }))

/**
 * Academy progress is off-chain, so these tests are about the two things that can still go wrong:
 * accepting input it should reject, and losing progress somebody already had.
 */
describe("Academy routes", () => {
  it("rejects a bad address", async () => {
    const response = await testApp(app).get("/academy/progress?address=nope")
    expect(response.status).toBe(400)
  })

  it("rejects an unknown module", async () => {
    const response = await testApp(app)
      .post("/academy/progress")
      .send({ address: ADDRESS, module: "solidity-101", quizScore: 5 })
    expect(response.status).toBe(400)
  })

  it("rejects a quiz score outside 0 to 5", async () => {
    const response = await testApp(app)
      .post("/academy/progress")
      .send({ address: ADDRESS, module: "uniswap-swaps", quizScore: 6 })
    expect(response.status).toBe(400)
  })

  it("starts empty for an address that has done nothing", async () => {
    const response = await testApp(app).get(`/academy/progress?address=${ADDRESS}`)
    expect(response.status).toBe(200)
    expect(response.body.modules).toEqual({})
    expect(response.body.openQuests).toEqual([])
  })

  it("passes at 4 of 5 and not at 3", async () => {
    const three = await testApp(app)
      .post("/academy/progress")
      .send({ address: ADDRESS, module: "uniswap-swaps", quizScore: 3 })
    expect(three.body.progress.quizPassed).toBe(false)

    const four = await testApp(app)
      .post("/academy/progress")
      .send({ address: ADDRESS, module: "attestcoin-proofs", quizScore: 4 })
    expect(four.body.progress.quizPassed).toBe(true)
  })

  it("keeps the best attempt when a later one is worse", async () => {
    await testApp(app)
      .post("/academy/progress")
      .send({ address: ADDRESS, module: "aave-supply-borrow", quizScore: 5 })
    const worse = await testApp(app)
      .post("/academy/progress")
      .send({ address: ADDRESS, module: "aave-supply-borrow", quizScore: 1 })

    expect(worse.body.progress.quizScore).toBe(5)
    expect(worse.body.progress.quizPassed).toBe(true)
  })

  it("accumulates lessons read rather than replacing them", async () => {
    await testApp(app)
      .post("/academy/progress")
      .send({ address: ADDRESS, module: "penguinswap-creditcoin", lessonsRead: [0, 2] })
    const second = await testApp(app)
      .post("/academy/progress")
      .send({ address: ADDRESS, module: "penguinswap-creditcoin", lessonsRead: [1] })

    expect(second.body.progress.lessonsRead).toEqual([0, 1, 2])
  })

  it("reads back everything that was saved, address case insensitively", async () => {
    const response = await testApp(app).get(
      `/academy/progress?address=${ADDRESS.toUpperCase().replace("0X", "0x")}`
    )
    expect(response.status).toBe(200)
    expect(Object.keys(response.body.modules).sort()).toEqual([
      "aave-supply-borrow",
      "attestcoin-proofs",
      "penguinswap-creditcoin",
      "uniswap-swaps",
    ])
  })
})

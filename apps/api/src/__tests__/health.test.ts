import { testApp } from "./helpers"
import express from "express"
import cors from "cors"

const app = express()
app.use(cors())
app.use(express.json())

app.get("/health", (req, res) => {
  res.json({ status: "ok", network: process.env.RPC_URL || "test" })
})

describe("Health Check", () => {
  it("should return 200 with status ok", async () => {
    const response = await testApp(app).get("/health")

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty("status", "ok")
    expect(response.body).toHaveProperty("network")
  })
})


import { testApp, createMockQuestInput } from "../../__tests__/helpers"
import express from "express"
import { getAllProtocols } from "../../lib/protocols"

// Test protocols endpoint without full router (avoid AI service import issues)
const app = express()
app.use(express.json())

app.get("/ai/protocols", (req, res) => {
  const protocols = getAllProtocols()
  res.json({ protocols })
})

describe("AI Routes", () => {
  describe("GET /ai/protocols", () => {
    it("should return list of supported protocols", async () => {
      const response = await testApp(app).get("/ai/protocols")

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty("protocols")
      expect(Array.isArray(response.body.protocols)).toBe(true)
      expect(response.body.protocols.length).toBeGreaterThan(0)
      expect(response.body.protocols[0]).toHaveProperty("name")
      expect(response.body.protocols[0]).toHaveProperty("evmAddress")
      expect(response.body.protocols[0]).toHaveProperty("category")
    })
  })

  // Note: POST /ai/quests tests require mocking AI service
  // For integration tests, mock generateQuestWithGroq function
  // or use real Groq API with test credentials
})


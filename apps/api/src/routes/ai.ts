import { Router } from "express"

import { generateQuestWithGroq } from "../services/aiQuestGenerator"
import { getAllProtocols } from "../lib/protocols"

export const aiRouter: Router = Router()

/**
 * GET /ai/protocols
 * Get list of supported DeFi protocols for quest generation
 */
aiRouter.get("/protocols", (req, res) => {
  const protocols = getAllProtocols()
  res.json({ protocols })
})

aiRouter.post("/quests", async (req, res, next) => {
  try {
    const result = await generateQuestWithGroq(req.body)
    res.status(result.onChainResult ? 201 : 200).json(result)
  } catch (error) {
    next(error)
  }
})


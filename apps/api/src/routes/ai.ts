import { Router } from "express"

import { getAllProtocols } from "../lib/protocols"

export const aiRouter: Router = Router()

/**
 * GET /ai/protocols
 *
 * The source-chain protocols a quest can name. Quest generation itself lives in
 * services/personalQuest, which creates the quest on chain with the rule that governs it; there is
 * no endpoint that writes a quest into a database and calls it generated.
 */
aiRouter.get("/protocols", (req, res) => {
  const protocols = getAllProtocols()
  res.json({ protocols })
})

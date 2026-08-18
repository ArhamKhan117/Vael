import cors from "cors"
import express from "express"

import { env } from "./config/env"
import { aiRouter } from "./routes/ai"
import { campaignsRouter } from "./routes/campaigns"
import { feedbackRouter } from "./routes/feedback"
import { questProofsRouter } from "./routes/questProofs"
import { questsRouter } from "./routes/quests"
import { startQuestPolling } from "./polling/questPolling"

// The cron scheduler starts itself on import.
import "./cron/scheduler"
startQuestPolling()

const app = express()

app.use(cors())
app.use(express.json({ limit: "1mb" }))

app.get("/health", (_, res) => {
  res.json({ status: "ok", network: "Creditcoin testnet" })
})

app.use("/ai", aiRouter)
app.use("/campaigns", campaignsRouter)
app.use("/feedback", feedbackRouter)
app.use("/quests", questsRouter)
app.use("/quests", questProofsRouter)

// There is deliberately no completion endpoint. A quest completes only when QuestASC
// verifies an Attestcoin proof on Creditcoin. No backend key can stand in for that.

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  const message = err?.message ?? "Unexpected error"
  res.status(500).json({ message })
})

app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT}`)
})


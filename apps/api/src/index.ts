import cors from "cors"
import express from "express"

import { env, hasServiceEnv } from "./config/env"
import { aiRouter } from "./routes/ai"
import { campaignsRouter } from "./routes/campaigns"
import { feedbackRouter } from "./routes/feedback"
import { questProofsRouter } from "./routes/questProofs"
import { questsRouter } from "./routes/quests"
import { gameRouter } from "./routes/game"
import { startQuestPolling } from "./polling/questPolling"

// AI quest generation and the Supabase-backed quest cache are optional. Starting their background
// jobs without credentials would fail on every tick and bury the logs, so they are started only
// when their dependencies actually exist. The proof, hero, and raid paths never need them.
if (hasServiceEnv()) {
  // The cron scheduler starts itself on import.
  void import("./cron/scheduler")
  startQuestPolling()
} else {
  console.log(
    "[startup] AI generation, IPFS pinning, and the Supabase cache are not configured. " +
      "Those routes answer 503; quests, proofs, hero, and raid work normally."
  )
}

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
app.use("/", gameRouter)

// There is deliberately no completion endpoint. A quest completes only when QuestASC
// verifies an Attestcoin proof on Creditcoin. No backend key can stand in for that.

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // A missing third-party credential is a configuration gap, not a bug: answer 503 with the name
  // of what is missing so an operator can fix it, rather than a 500 that reads like a crash.
  const status = typeof err?.status === "number" ? err.status : 500
  if (status !== 503) console.error(err)
  res.status(status).json({ message: err?.message ?? "Unexpected error" })
})

app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT}`)
})


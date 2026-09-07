import cors from "cors"
import express from "express"

import { env, hasServiceEnv } from "./config/env"
import { academyRouter } from "./routes/academy"
import { aiRouter } from "./routes/ai"
import { catalogRouter } from "./routes/catalog"
import { feedbackRouter } from "./routes/feedback"
import { questProofsRouter } from "./routes/questProofs"
import { questsRouter } from "./routes/quests"
import { gameRouter } from "./routes/game"
import { modulesRouter } from "./routes/modules"
import { partnerRouter } from "./routes/partner"
import { personalQuestRouter } from "./routes/personalQuests"

// AI quest generation and the Supabase-backed quest cache are optional. Starting their background
// jobs without credentials would fail on every tick and bury the logs, so they are started only
// when their dependencies actually exist. The proof, hero, and raid paths never need them.
if (hasServiceEnv()) {
  // The cron scheduler starts itself on import.
  void import("./cron/scheduler.js")
} else {
  console.log(
    "[startup] AI generation, IPFS pinning, and the Supabase cache are not configured. " +
      "Those routes answer 503; quests, proofs, hero, and raid work normally."
  )
}

const app = express()

app.use(cors())

/**
 * One route takes an image, and only one.
 *
 * A quest banner arrives as a base64 data URL, which is about a third larger than the file, so
 * 1mb would refuse a 900 KB picture. Raising the limit globally would widen the body every route
 * accepts to suit a single one of them, so the larger limit is named where it is needed and
 * everything else keeps the tight default.
 */
const LARGE_BODY_PATHS = new Set(["/partner/metadata"])
app.use((req, res, next) =>
  express.json({ limit: LARGE_BODY_PATHS.has(req.path) ? "4mb" : "1mb" })(req, res, next)
)

app.get("/health", (_, res) => {
  res.json({ status: "ok", network: "Creditcoin testnet" })
})

app.use("/academy", academyRouter)
app.use("/ai", personalQuestRouter)
app.use("/ai", aiRouter)
app.use("/feedback", feedbackRouter)
app.use("/quests", questsRouter)
app.use("/quests", questProofsRouter)
// Last of the three, so the specific /quests routes above win over its /quests/:id.
app.use("/", catalogRouter)
app.use("/", gameRouter)
app.use("/", modulesRouter)
app.use("/partner", partnerRouter)

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


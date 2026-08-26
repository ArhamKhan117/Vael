import { Router } from "express"

import { createWorkerStore } from "../attestcoin/store"
import type { AcademyModuleProgress, AcademyProgress } from "../attestcoin/store/types"

export const academyRouter: Router = Router()

/**
 * A quiz is passed at 4 of 5. The web app states the same mark against the same content, and both
 * are checked in a test, so neither side can drift into disagreeing about what passing means.
 */
const PASS_MARK = 4
const QUESTIONS_PER_QUIZ = 5

/** Slugs the API will accept, matching apps/web/src/content/academy. */
const MODULE_SLUGS = [
  "attestcoin-proofs",
  "uniswap-swaps",
  "aave-supply-borrow",
  "penguinswap-creditcoin",
] as const

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)
}

function emptyProgress(player: string): AcademyProgress {
  return { player: player.toLowerCase(), modules: {}, updatedAt: new Date().toISOString() }
}

/**
 * GET /academy/progress?address=0x...
 *
 * Progress is a convenience, not a gate. It records which lessons an address marked read and which
 * quizzes it passed, and it grants nothing: the badge for a module comes from its do quest, which
 * QuestASC verifies from a proof like any other. `openQuests` lists the quests this address has
 * accepted and not completed, so a module can link to the real one rather than to an invented id.
 */
academyRouter.get("/progress", async (req, res, next) => {
  try {
    const address = req.query.address
    if (!isAddress(address)) {
      return res.status(400).json({ message: "address must be a 20-byte hex address" })
    }
    const store = createWorkerStore()
    await store.init()

    const [progress, openQuests] = await Promise.all([
      store.getAcademyProgress(address),
      store.openQuestsFor(address),
    ])

    return res.json({
      address: address.toLowerCase(),
      modules: progress?.modules ?? {},
      updatedAt: progress?.updatedAt ?? null,
      openQuests: openQuests.map((quest) => ({
        questId: quest.questId,
        actionType: quest.actionType,
        minAmount: quest.minAmount,
      })),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /academy/progress
 *
 * Body: { address, module, lessonsRead?: number[], quizScore?: number }
 *
 * Both fields are optional so marking a lesson read and submitting a quiz are separate calls.
 * `quizPassed` is derived here rather than accepted from the client, which is not a security
 * boundary (nothing on chain reads it) but does keep one definition of passing.
 */
academyRouter.post("/progress", async (req, res, next) => {
  try {
    const { address, module: slug, lessonsRead, quizScore } = req.body ?? {}

    if (!isAddress(address)) {
      return res.status(400).json({ message: "address must be a 20-byte hex address" })
    }
    if (typeof slug !== "string" || !MODULE_SLUGS.includes(slug as (typeof MODULE_SLUGS)[number])) {
      return res.status(400).json({ message: `module must be one of: ${MODULE_SLUGS.join(", ")}` })
    }
    if (lessonsRead !== undefined) {
      const valid =
        Array.isArray(lessonsRead) &&
        lessonsRead.every((n) => Number.isInteger(n) && n >= 0 && n < 16)
      if (!valid) {
        return res.status(400).json({ message: "lessonsRead must be an array of lesson indices" })
      }
    }
    if (quizScore !== undefined) {
      const valid = Number.isInteger(quizScore) && quizScore >= 0 && quizScore <= QUESTIONS_PER_QUIZ
      if (!valid) {
        return res
          .status(400)
          .json({ message: `quizScore must be an integer between 0 and ${QUESTIONS_PER_QUIZ}` })
      }
    }

    const store = createWorkerStore()
    await store.init()

    const progress = (await store.getAcademyProgress(address)) ?? emptyProgress(address)
    const existing: AcademyModuleProgress = progress.modules[slug] ?? {
      lessonsRead: [],
      quizScore: 0,
      quizPassed: false,
      updatedAt: new Date().toISOString(),
    }

    // Lessons only ever accumulate, and the best quiz attempt stands. Re-reading a module or
    // retaking a quiz should never cost somebody progress they already had.
    const merged = new Set([...existing.lessonsRead, ...((lessonsRead as number[]) ?? [])])
    const bestScore = Math.max(existing.quizScore, (quizScore as number) ?? 0)

    const updated: AcademyModuleProgress = {
      lessonsRead: [...merged].sort((a, b) => a - b),
      quizScore: bestScore,
      quizPassed: bestScore >= PASS_MARK,
      updatedAt: new Date().toISOString(),
    }

    progress.modules[slug] = updated
    progress.updatedAt = updated.updatedAt
    await store.saveAcademyProgress(progress)

    return res.json({ address: progress.player, module: slug, progress: updated })
  } catch (error) {
    next(error)
  }
})

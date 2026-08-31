import cron from "node-cron"
import { processExpiredQuests } from "../services/dailyWeeklyQuestService"

// Registers its own daily and weekly schedules on import.
import "./personalQuests"

/**
 * Expiry-driven quest regeneration.
 * The trigger is a quest expiring, not a wall-clock hour. Every run looks for quests whose
 * expiry_timestamp has passed, marks them expired, and generates replacements.
 */
cron.schedule("*/5 * * * *", async () => {
  console.log("[CRON] Checking for expired daily/weekly quests...", new Date().toISOString())
  try {
    const stats = await processExpiredQuests()
    if (stats.processed > 0) {
      console.log(
        `[CRON] Processed ${stats.processed} expired quests — daily: ${stats.daily.success} ok, ${stats.daily.failed} failed | weekly: ${stats.weekly.success} ok, ${stats.weekly.failed} failed`
      )
    }
  } catch (error: any) {
    console.error("[CRON] processExpiredQuests failed:", error.message)
  }
})

console.log("[CRON] Scheduler initialized:")
console.log("  - Expiry-driven quest regeneration: every 5 min, triggered by expired quests")


import cron from "node-cron"

import { createWorkerStore } from "../attestcoin/store"
import { generatePersonalQuest } from "../services/personalQuest"

/**
 * Daily and weekly personal quests.
 *
 * Who gets one is decided by the index rather than by a signup list: every address that has minted
 * a hero is a player, and a hero can only exist because somebody minted it. Nothing here can grant
 * a reward; it only creates a quest whose rule the chain will enforce.
 *
 * The cadence is wall-clock because that is what "daily" and "weekly" mean to a player. The
 * expiry-driven regeneration in the other scheduler is a different thing and stays as it is.
 */
const DAILY = "0 9 * * *"
const WEEKLY = "0 10 * * 1"

async function generateFor(cadence: "daily" | "weekly") {
  const store = createWorkerStore()
  await store.init()
  const heroes = await store.allHeroes()
  if (heroes.length === 0) {
    console.log(`[CRON] ${cadence} personal quests: nobody has a hero yet`)
    return
  }

  let ok = 0
  let failed = 0
  for (const hero of heroes) {
    try {
      const quest = await generatePersonalQuest(hero.player, cadence)
      ok += 1
      console.log(
        `[CRON] ${cadence} quest ${quest.questId} for ${hero.player}: ${quest.draft.title} (${quest.draft.action})`
      )
    } catch (error) {
      failed += 1
      // One player's failure must not stop everybody else's quest.
      console.error(`[CRON] ${cadence} quest for ${hero.player} failed:`, (error as Error).message)
    }
  }
  console.log(`[CRON] ${cadence} personal quests: ${ok} created, ${failed} failed`)
}

cron.schedule(DAILY, () => {
  void generateFor("daily")
})

cron.schedule(WEEKLY, () => {
  void generateFor("weekly")
})

console.log(`  - Personal quests: daily at ${DAILY}, weekly at ${WEEKLY}`)

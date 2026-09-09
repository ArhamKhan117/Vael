-- Remove the eight tables from the design that predates the chain being the source of truth.
--
-- Vael started with a database that held quests, submissions, XP and campaigns, and the chain was
-- somewhere rewards eventually went. That is backwards for this project, and milestone 8 inverted it:
-- every quest, badge, action and reward is now read back out of Creditcoin, and the database holds
-- an index of what the chain emitted plus the three things the chain does not own, which are a
-- player's name, their feedback, and their Academy progress.
--
-- These eight have had no reader and no writer since then. Leaving them is not free: a schema that
-- still shows `quests` and `user_xp_ledger` tells the next person that quest state and XP live in
-- Postgres, which is the exact misunderstanding the architecture exists to prevent.
--
-- Nothing is lost. Seven were empty. `cron_state` held one row, a `quest_accepted_cursor` at block
-- 5464093, which is both stale by three redeploys and superseded by `worker_cursors`, the table the
-- worker actually reads.
--
-- Children before parents: campaign_participants and quests both reference campaigns.

DROP TABLE IF EXISTS campaign_participants CASCADE;
DROP TABLE IF EXISTS quest_submissions CASCADE;
DROP TABLE IF EXISTS quests CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS user_xp_ledger CASCADE;
DROP TABLE IF EXISTS user_stats CASCADE;
DROP TABLE IF EXISTS ai_generation_logs CASCADE;
DROP TABLE IF EXISTS cron_state CASCADE;

-- The trigger function that kept user_stats in step with user_xp_ledger has no table left to read
-- or write, so it goes with them. The triggers themselves went with their tables under CASCADE.
DROP FUNCTION IF EXISTS update_user_stats_on_xp() CASCADE;

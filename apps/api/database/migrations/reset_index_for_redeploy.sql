-- Empty every table the indexer and the worker fill, so the index can be rebuilt from the new
-- deployment.
--
-- Nothing here is authoritative. Every row in every one of these tables exists because Creditcoin
-- emitted an event, so emptying them costs nothing that a rescan cannot rebuild. They are emptied
-- rather than left because the old rows describe superseded contracts: quest ids restart at 1 on
-- QuestManager v7, badge token ids were re-minted on BadgeNFT v3, and the raid season counter
-- restarts on RaidBoss v2, so a merged index would show two quest 1s and disagree with the chain
-- about both.
--
-- The superseded contracts keep their own history; it is readable on them, and the addresses are
-- in the history section of docs/ADDRESSES.md.
--
-- users, feedback, and academy_progress are deliberately absent: none of them is derived from a
-- contract, and a player's name is not invalidated by a redeploy.

DELETE FROM indexed_quests;
DELETE FROM indexed_campaigns;
DELETE FROM verified_actions;
DELETE FROM reward_releases;
DELETE FROM indexed_badges;
DELETE FROM hero_snapshots;
DELETE FROM raid_damage;
DELETE FROM arena_challenges;
DELETE FROM loot_drops;
DELETE FROM equipment_events;
DELETE FROM market_listings;
DELETE FROM proof_submissions;
DELETE FROM worker_cursors;

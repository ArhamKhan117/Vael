-- A campaign's own document.
--
-- CampaignEscrow stores a bytes32 key and no name, so a pool had nothing to call itself and the
-- API named it after its quests: where every quest in a pool agreed on a title, that was the pool's
-- name, and where they did not, the card read "Pool 0x07e1398c...". Two pools came to disagree the
-- moment a fourth quest with its own title was added to each.
--
-- The partner now pins a document for the pool itself (name, summary, picture) through
-- POST /partner/campaign/:id/metadata, and these are its three fields plus the URI it was pinned
-- at. `title` and `campaign_id` already exist. Nothing on chain references the document; the
-- escrow was deliberately built without one, so the row is where the reference lives.
ALTER TABLE indexed_campaigns
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS metadata_uri TEXT;

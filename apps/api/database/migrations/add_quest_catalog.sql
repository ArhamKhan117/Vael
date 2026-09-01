-- The player-facing quest catalog and campaign pools, both derived from Creditcoin's own events.
--
-- Before this, /quests and /campaigns read two tables the product no longer writes: a quest row
-- was created by a database-first generator that predates QuestASC, and a campaign row by a
-- studio flow that never bound the campaign to its escrow. Both tables were empty while the chain
-- held eleven quests and two funded pools, so the pages showed nothing and told the truth about
-- nothing.
--
-- Neither of the shapes below is authoritative. Every column is filled from an event the chain
-- emitted plus a read of the contract that emitted it, so a wiped index is rebuilt by rescanning.

-- The catalog rides on indexed_quests rather than beside it: the worker already keys that table by
-- quest id, and a second table would let the two disagree about which quests exist.
ALTER TABLE indexed_quests
  ADD COLUMN IF NOT EXISTS category SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS protocol TEXT,
  ADD COLUMN IF NOT EXISTS metadata_uri TEXT,
  ADD COLUMN IF NOT EXISTS reward_token TEXT,
  ADD COLUMN IF NOT EXISTS reward_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge_level SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expiry BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at_chain BIGINT NOT NULL DEFAULT 0,
  -- uint256 as a decimal string: '0' means the reward comes from RewardVault, anything else names
  -- a CampaignEscrow pool.
  ADD COLUMN IF NOT EXISTS campaign_id TEXT NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS accepted_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_count INTEGER NOT NULL DEFAULT 0,
  -- Copied out of the pinned metadata document so a list page does not fetch eleven IPFS
  -- documents to render eleven cards.
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  -- 'daily', 'weekly', 'campaign', or 'open'. Campaign comes from the chain; daily and weekly come
  -- from the Cadence attribute the generator pins with the quest.
  ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS creditcoin_block BIGINT NOT NULL DEFAULT 0,
  -- False until a QuestCreated has been seen and the quest read back off QuestManager. A row the
  -- worker created from a rule alone is matchable but not yet displayable.
  ADD COLUMN IF NOT EXISTS catalogued BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_indexed_quests_catalog
  ON indexed_quests(catalogued, cadence, quest_id DESC);

-- One row per campaign the escrow has ever held money for.
--
-- The escrow keys pools by bytes32 and knows nothing else about them, so the deposit, the payouts,
-- and the refunds come from its events while the human label comes from the partner publish call
-- that created the campaign's quests. A pool funded outside that flow still lists; it just shows
-- its key instead of a name.
CREATE TABLE IF NOT EXISTS indexed_campaigns (
  campaign_key TEXT PRIMARY KEY,
  campaign_id TEXT,
  title TEXT,
  partner TEXT NOT NULL DEFAULT '',
  deposited NUMERIC NOT NULL DEFAULT 0,
  released NUMERIC NOT NULL DEFAULT 0,
  refunded NUMERIC NOT NULL DEFAULT 0,
  first_seen_block BIGINT NOT NULL DEFAULT 0,
  -- Position of the last escrow log folded into the totals above. The totals accumulate, so a
  -- rescan over blocks already counted would double them; anything at or before this position is
  -- skipped instead. Logs arrive in ascending order, so forward progress is unaffected.
  last_block BIGINT NOT NULL DEFAULT -1,
  last_log_index INTEGER NOT NULL DEFAULT -1,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indexed_campaigns_partner ON indexed_campaigns(partner);

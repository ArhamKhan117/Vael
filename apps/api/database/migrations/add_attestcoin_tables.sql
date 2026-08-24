-- Attestcoin proof pipeline and game state tables (docs/SPEC.md section 12).
-- Chain events are the source of truth. Every table here is a cache the indexer can rebuild.

-- One row per source-chain transaction as it moves through the proof pipeline.
CREATE TABLE IF NOT EXISTS proof_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quest_id_on_chain BIGINT NOT NULL,
  participant TEXT NOT NULL,
  source_chain_key SMALLINT NOT NULL DEFAULT 1, -- 1 Sepolia, 3 Ethereum mainnet
  source_tx_hash TEXT NOT NULL,
  source_block BIGINT,
  action_type SMALLINT, -- 0 Portal, 1 UniswapSwap, 2 Erc20Transfer, 3 AaveSupply, 4 AaveBorrow
  status TEXT NOT NULL DEFAULT 'detected', -- detected, attesting, proving, submitted, verified, failed
  query_id TEXT, -- keccak(chainKey, blockHeight, txIndex)
  creditcoin_tx_hash TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_chain_key, source_tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_proof_submissions_status ON proof_submissions(status);
CREATE INDEX IF NOT EXISTS idx_proof_submissions_quest ON proof_submissions(quest_id_on_chain);
CREATE INDEX IF NOT EXISTS idx_proof_submissions_participant ON proof_submissions(LOWER(participant));

-- Per-emitter log cursor so the watcher resumes where it stopped after a restart.
CREATE TABLE IF NOT EXISTS worker_cursors (
  chain_key SMALLINT NOT NULL,
  emitter TEXT NOT NULL,
  last_block BIGINT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (chain_key, emitter)
);

-- Hero state mirrored from VaelHero on Creditcoin.
CREATE TABLE IF NOT EXISTS hero_snapshots (
  address TEXT PRIMARY KEY,
  token_id BIGINT,
  level INTEGER NOT NULL DEFAULT 1,
  xp BIGINT NOT NULL DEFAULT 0,
  strength INTEGER NOT NULL DEFAULT 0,
  agility INTEGER NOT NULL DEFAULT 0,
  intellect INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raid damage ledger, one row per verified action.
CREATE TABLE IF NOT EXISTS raid_damage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id BIGINT NOT NULL,
  player TEXT NOT NULL,
  damage NUMERIC NOT NULL,
  query_id TEXT NOT NULL,
  creditcoin_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(season_id, query_id)
);

CREATE INDEX IF NOT EXISTS idx_raid_damage_season_player ON raid_damage(season_id, LOWER(player));

-- Academy progress. Module badges are still minted through a proof-gated quest.
CREATE TABLE IF NOT EXISTS academy_progress (
  address TEXT NOT NULL,
  module TEXT NOT NULL,
  step INTEGER NOT NULL DEFAULT 0,
  quiz_score INTEGER,
  completed_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (address, module)
);

-- Existing submissions predate the proof pipeline; bring them onto the same shape.
ALTER TABLE quest_submissions ADD COLUMN IF NOT EXISTS source_chain_key SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE quest_submissions ADD COLUMN IF NOT EXISTS query_id TEXT;
ALTER TABLE quest_submissions DROP COLUMN IF EXISTS mirror_node_payload;

-- Chain-derived quest index. Everything here comes from Creditcoin events, so it is a cache the
-- indexer can rebuild; it exists so the worker can answer "which quest does this Sepolia log
-- belong to?" for protocols whose events know nothing about Vael.
CREATE TABLE IF NOT EXISTS indexed_quests (
  quest_id BIGINT PRIMARY KEY,
  participant TEXT NOT NULL,
  source_chain_key SMALLINT NOT NULL DEFAULT 1,
  action_type SMALLINT NOT NULL,
  emitter TEXT NOT NULL,
  token TEXT,
  min_amount NUMERIC NOT NULL DEFAULT 0,
  accepted_at_source_height BIGINT,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indexed_quests_open
  ON indexed_quests(participant, accepted, completed);

-- A raid hit is identified by its replay key, so re-scanning a range cannot double-count damage.
ALTER TABLE raid_damage DROP CONSTRAINT IF EXISTS raid_damage_season_id_query_id_key;
ALTER TABLE raid_damage ADD CONSTRAINT raid_damage_season_id_query_id_key UNIQUE (season_id, query_id);

-- Vael database schema for Supabase.
-- These tables are a cache and an index over Creditcoin. Chain events are the source of
-- truth; everything here is rebuildable by the indexer.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table: profil user dengan wallet address
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  ens_name TEXT,
  nickname TEXT,
  avatar_url TEXT,
  join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on wallet_address for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Quests: AI-generated quest metadata, cached off-chain
CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quest_id_on_chain BIGINT NOT NULL UNIQUE, -- Quest id from QuestManager
  agent_id BIGINT, -- Agent id from the ERC-8004 registry
  agent_controller TEXT, -- Address controller agent
  title TEXT NOT NULL,
  description TEXT,
  project_name TEXT,
  category TEXT, -- swap, liquidity, stake, lend
  protocol_address TEXT, -- Protocol contract this quest targets
  metadata_uri TEXT, -- IPFS URI of the full metadata document
  parameters_hash TEXT, -- Hash parameter quest
  reward_per_participant NUMERIC, -- VAEL reward amount
  badge_level INTEGER,
  assigned_participant TEXT, -- Player this quest is assigned to
  expiry_timestamp BIGINT, -- Unix timestamp expiry
  status TEXT DEFAULT 'active', -- active, completed, cancelled, expired
  accepted_at TIMESTAMP WITH TIME ZONE, -- Timestamp saat quest di-accept on-chain
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for quest queries
CREATE INDEX IF NOT EXISTS idx_quests_quest_id_on_chain ON quests(quest_id_on_chain);
CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status);
CREATE INDEX IF NOT EXISTS idx_quests_assigned_participant ON quests(assigned_participant);
CREATE INDEX IF NOT EXISTS idx_quests_created_at ON quests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quests_accepted_at ON quests(accepted_at DESC);

-- Cron state table (for polling cursors)
CREATE TABLE IF NOT EXISTS cron_state (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quest submissions: source-chain transactions registered for proving.
-- A row here proves nothing. Completion happens on Creditcoin when QuestASC verifies
-- an Attestcoin proof.
CREATE TABLE IF NOT EXISTS quest_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quest_id_on_chain BIGINT NOT NULL,
  participant_address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  source_chain_key SMALLINT NOT NULL DEFAULT 1, -- Attestcoin source chain: 1 Sepolia, 3 mainnet
  query_id TEXT, -- keccak(chainKey, blockHeight, txIndex) once proved
  verification_status TEXT DEFAULT 'detected', -- detected, attesting, proving, submitted, verified, failed
  evidence_uri TEXT,
  completion_tx_hash TEXT, -- Creditcoin tx hash of the verified completion
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent duplicate submissions
  UNIQUE(quest_id_on_chain, transaction_hash)
);

-- Create indexes for submission queries
CREATE INDEX IF NOT EXISTS idx_quest_submissions_quest_id ON quest_submissions(quest_id_on_chain);
CREATE INDEX IF NOT EXISTS idx_quest_submissions_participant ON quest_submissions(participant_address);
CREATE INDEX IF NOT EXISTS idx_quest_submissions_tx_hash ON quest_submissions(transaction_hash);

-- User XP ledger: XP earned per quest
CREATE TABLE IF NOT EXISTS user_xp_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL, -- Denormalized for fast queries
  quest_id_on_chain BIGINT NOT NULL,
  xp_amount INTEGER NOT NULL,
  reward_amount NUMERIC, -- VAEL amount, if any
  badge_token_id BIGINT, -- Badge NFT token id, if any
  completion_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for XP queries
CREATE INDEX IF NOT EXISTS idx_user_xp_ledger_user_id ON user_xp_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_ledger_wallet_address ON user_xp_ledger(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_xp_ledger_quest_id ON user_xp_ledger(quest_id_on_chain);
CREATE INDEX IF NOT EXISTS idx_user_xp_ledger_created_at ON user_xp_ledger(created_at DESC);

-- User stats: aggregated leaderboard figures, updated by trigger
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL UNIQUE,
  total_xp INTEGER DEFAULT 0,
  completed_quests INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1, -- Calculate: floor(total_xp / 5000) + 1
  rank INTEGER, -- Updated via leaderboard query
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_stats_total_xp ON user_stats(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_completed_quests ON user_stats(completed_quests DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_rank ON user_stats(rank);

-- AI generation logs: one row per AI quest generation
CREATE TABLE IF NOT EXISTS ai_generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quest_id_on_chain BIGINT,
  prompt_input JSONB, -- Input prompt ke AI
  ai_output JSONB, -- Raw Groq output
  metadata_uri TEXT,
  ipfs_cid TEXT,
  deployed_on_chain BOOLEAN DEFAULT FALSE,
  deployment_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for AI logs
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_quest_id ON ai_generation_logs(quest_id_on_chain);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_created_at ON ai_generation_logs(created_at DESC);

-- Function: Update user_stats when XP is added
CREATE OR REPLACE FUNCTION update_user_stats_on_xp()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id, wallet_address, total_xp, completed_quests, level)
  VALUES (
    NEW.user_id,
    NEW.wallet_address,
    COALESCE((SELECT total_xp FROM user_stats WHERE user_id = NEW.user_id), 0) + NEW.xp_amount,
    COALESCE((SELECT completed_quests FROM user_stats WHERE user_id = NEW.user_id), 0) + 1,
    FLOOR((COALESCE((SELECT total_xp FROM user_stats WHERE user_id = NEW.user_id), 0) + NEW.xp_amount) / 5000) + 1
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_xp = user_stats.total_xp + NEW.xp_amount,
    completed_quests = user_stats.completed_quests + 1,
    level = FLOOR((user_stats.total_xp + NEW.xp_amount) / 5000) + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update user_stats when XP is added
DROP TRIGGER IF EXISTS trigger_update_user_stats_on_xp ON user_xp_ledger;
CREATE TRIGGER trigger_update_user_stats_on_xp
  AFTER INSERT ON user_xp_ledger
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_on_xp();

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at on relevant tables
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_quests_updated_at ON quests;
CREATE TRIGGER trigger_quests_updated_at
  BEFORE UPDATE ON quests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_quest_submissions_updated_at ON quest_submissions;
CREATE TRIGGER trigger_quest_submissions_updated_at
  BEFORE UPDATE ON quest_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


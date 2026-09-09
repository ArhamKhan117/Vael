-- Vael's base schema for Supabase.
--
-- **The chain is the source of truth.** Every quest, badge, action, reward, duel, drop and listing
-- is read back out of Creditcoin, and the tables that hold them are an index the indexer can
-- rebuild from scratch: see the `add_*` migrations beside this file, and
-- `reset_index_for_redeploy.sql` for what rebuilding looks like.
--
-- This file holds the one thing the chain does not own and cannot rebuild: who somebody says they
-- are. A wallet address is on chain; a nickname and an avatar are not, and losing them is a real
-- loss rather than a rescan.
--
-- Two other tables are also not derived from the chain and are created by their own migrations:
-- `feedback` (add_feedback.sql) and `academy_progress` (fix_academy_progress_shape.sql). Academy
-- progress deliberately grants nothing: the badge for a module comes from its quest, which QuestASC
-- verifies from a proof like any other.
--
-- An earlier design kept quests, submissions, XP and campaigns in Postgres and treated the chain as
-- somewhere rewards eventually went. Eight tables from it survived here long after the last reader
-- was deleted, which told anybody reading this file that quest state and XP live in Postgres. They
-- are removed by `drop_database_first_tables.sql`.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- A player's profile. The wallet address is the identity; the rest is what they chose to be called.
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

CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

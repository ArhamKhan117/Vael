-- Quest Marketplace: campaigns + campaign_participants

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_wallet TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'completed', 'cancelled')),
  template_type TEXT NOT NULL CHECK (template_type IN ('swap', 'deposit', 'borrow', 'stake')),
  template_params JSONB NOT NULL DEFAULT '{}',
  pool_token TEXT NOT NULL DEFAULT 'USDC',
  pool_amount NUMERIC NOT NULL,
  max_participants INTEGER NOT NULL,
  reward_per_quest_usdc NUMERIC NOT NULL,
  vael_per_quest INTEGER,
  escrow_address TEXT,
  escrow_tx_hash TEXT,
  participant_count INTEGER NOT NULL DEFAULT 0,
  claimed_count INTEGER NOT NULL DEFAULT 0,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  metadata_uri TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_partner ON campaigns(partner_wallet);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Campaign participants: who joined and got a quest
CREATE TABLE IF NOT EXISTS campaign_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  participant_wallet TEXT NOT NULL,
  quest_id_on_chain BIGINT NOT NULL,
  usdc_released BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, participant_wallet)
);

CREATE INDEX IF NOT EXISTS idx_campaign_participants_campaign ON campaign_participants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_wallet ON campaign_participants(participant_wallet);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_quest ON campaign_participants(quest_id_on_chain);

-- Link quests to campaigns
ALTER TABLE quests ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quests_campaign_id ON quests(campaign_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_campaigns_updated_at ON campaigns;
CREATE TRIGGER trigger_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

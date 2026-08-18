-- Migration: Add quest_type field to quests table
-- Run this migration in Supabase SQL Editor

ALTER TABLE quests 
ADD COLUMN IF NOT EXISTS quest_type TEXT CHECK (quest_type IN ('custom', 'daily', 'weekly'));

-- Update existing quests to 'custom' type
UPDATE quests SET quest_type = 'custom' WHERE quest_type IS NULL;

-- Set default to 'custom'
ALTER TABLE quests 
ALTER COLUMN quest_type SET DEFAULT 'custom';

-- Create index for quest_type queries
CREATE INDEX IF NOT EXISTS idx_quests_quest_type ON quests(quest_type);
CREATE INDEX IF NOT EXISTS idx_quests_type_participant ON quests(quest_type, assigned_participant);


-- Add partner_name to campaigns
-- Run in Supabase SQL Editor
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS partner_name TEXT;

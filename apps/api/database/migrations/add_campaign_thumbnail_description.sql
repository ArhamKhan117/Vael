-- Add thumbnail and description to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS description TEXT;

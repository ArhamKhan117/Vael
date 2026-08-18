-- Migration: Add name and email fields to users table
-- Run this migration in Supabase SQL Editor

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for email lookups (if needed)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;


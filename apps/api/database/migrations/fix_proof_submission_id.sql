-- proof_submissions.id is a natural key, not a UUID.
--
-- The store computes `{chainKey}:{sourceTxHash}:{questId}` and upserts on it, which is what makes a
-- re-observed Sepolia log idempotent rather than a second submission. The column was declared UUID,
-- so every insert against Supabase failed with "invalid input syntax for type uuid" and the worker
-- could not record a single submission. The file store has no types, so this was invisible until
-- the worker ran against Supabase for real.
--
-- The unique constraint had the same shape of problem. One source transaction can carry logs for
-- two different quests, which is exactly what the log-scoped replay key exists to allow, so
-- UNIQUE(source_chain_key, source_tx_hash) would reject the second one.
--
-- Idempotent: guarded on the column's current type, and the constraint swap is guarded on its name.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'proof_submissions'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE proof_submissions ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE proof_submissions ALTER COLUMN id TYPE TEXT USING id::text;
    RAISE NOTICE 'proof_submissions.id widened from uuid to text';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proof_submissions_source_chain_key_source_tx_hash_key'
  ) THEN
    ALTER TABLE proof_submissions
      DROP CONSTRAINT proof_submissions_source_chain_key_source_tx_hash_key;
    RAISE NOTICE 'dropped the transaction-only unique constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proof_submissions_source_quest_key'
  ) THEN
    ALTER TABLE proof_submissions
      ADD CONSTRAINT proof_submissions_source_quest_key
      UNIQUE (source_chain_key, source_tx_hash, quest_id_on_chain);
    RAISE NOTICE 'added the transaction-and-quest unique constraint';
  END IF;
END
$$;

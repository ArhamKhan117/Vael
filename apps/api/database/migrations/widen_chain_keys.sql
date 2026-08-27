-- Widen every chain-key column from SMALLINT to BIGINT.
--
-- The original schema sized these for source chain keys, which are small (Sepolia is 1, Ethereum
-- mainnet is 3). The Creditcoin indexer then reused worker_cursors with the Creditcoin chain id
-- 102031 as its key, which does not fit in a SMALLINT: a fresh database aborts on the first
-- backfill with "smallint out of range", and the failure looks like an indexer bug rather than a
-- schema one.
--
-- ALTER TYPE to a wider integer is not idempotent on its own, so each change is guarded on the
-- column's current type. Running this against a database already widened by hand does nothing.

DO $$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'smallint'
      AND (table_name, column_name) IN (
        ('proof_submissions', 'source_chain_key'),
        ('worker_cursors', 'chain_key'),
        ('quest_submissions', 'source_chain_key'),
        ('indexed_quests', 'source_chain_key')
      )
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE BIGINT', target.table_name, target.column_name);
    RAISE NOTICE 'widened %.% to bigint', target.table_name, target.column_name;
  END LOOP;
END
$$;

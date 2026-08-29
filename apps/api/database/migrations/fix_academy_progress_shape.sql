-- Reshape academy_progress to the one shape the store actually reads.
--
-- Two migrations declared this table. add_attestcoin_tables.sql declared a row-per-module shape
-- (address, module, step, quiz_score, completed_at) before the academy existed; the academy then
-- shipped with a row-per-address shape (player, modules jsonb, updated_at). Both used
-- CREATE TABLE IF NOT EXISTS, so on a database where the older file ran first the newer
-- declaration was a silent no-op and every read failed with
-- "column academy_progress.player does not exist". The file store has the right shape by
-- construction, so the tests passed and only the live database was broken.
--
-- Idempotent: it does nothing when the table is already correct. The legacy shape carries no
-- equivalent of `modules`, so there is nothing to migrate across, and no current code can read a
-- legacy row; the count is raised as a notice before the table goes.

DO $$
DECLARE
  legacy_rows bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'academy_progress'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'academy_progress' AND column_name = 'player'
  ) THEN
    EXECUTE 'SELECT count(*) FROM academy_progress' INTO legacy_rows;
    RAISE NOTICE 'dropping the legacy academy_progress shape, % row(s) discarded', legacy_rows;
    DROP TABLE academy_progress;
  END IF;
END
$$;

create table if not exists academy_progress (
  player text primary key,
  -- { "<module slug>": { lessonsRead: number[], quizScore: number, quizPassed: boolean, updatedAt } }
  modules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

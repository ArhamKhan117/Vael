-- Record the block whose hash seeds a duel.
--
-- Arena v3 commits `seedBlock` at acceptance instead of drawing the seed from the previous block
-- at resolution, so which block a duel was fought from is now a fact worth keeping: it is what
-- makes the outcome checkable by anyone, and it bounds the window the duel had to be resolved in.
--
-- Nullable, because the superseded Arena's ArenaAccepted event carried no such field and a rescan
-- over its blocks has nothing to put here.
ALTER TABLE arena_challenges
  ADD COLUMN IF NOT EXISTS seed_block BIGINT;

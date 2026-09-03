-- Give raid_damage the three columns its own type has always had.
--
-- IndexedRaidHit carries hpRemaining, actionType and creditcoinBlock, all three straight off the
-- RaidDamage event, and the table had nowhere to put them: the writer dropped them and the reader
-- hardcoded zero. `/raid/current` therefore reported every hit as having left the boss on 0 HP,
-- which is a number that looked like data and was not.
--
-- Rows written before this migration have no way to recover the values, so the columns are
-- nullable and the reader reports what is there rather than inventing a zero.

ALTER TABLE raid_damage
  ADD COLUMN IF NOT EXISTS hp_remaining NUMERIC,
  ADD COLUMN IF NOT EXISTS action_type SMALLINT,
  ADD COLUMN IF NOT EXISTS creditcoin_block BIGINT;

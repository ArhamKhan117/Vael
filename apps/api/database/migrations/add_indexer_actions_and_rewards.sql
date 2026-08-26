-- Verified-action history and VAEL payouts, indexed from Creditcoin's own events.
--
-- Neither table is authoritative. Every row exists because the chain emitted the event, and both
-- are rebuilt by rescanning from the indexer cursor. They exist because a profile page and a
-- leaderboard cannot be assembled from per-request contract calls.

create table if not exists verified_actions (
  -- QuestASC's log-scoped replay key. Unique on chain, so a rescan cannot double-count.
  replay_key text primary key,
  quest_id bigint not null,
  player text not null,
  action_type smallint not null,
  -- Height on the source chain the proved log came from.
  source_block bigint not null,
  -- Amount the adapter decoded, in the source token's own units, as a decimal string.
  amount numeric not null default 0,
  creditcoin_block bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists verified_actions_player_idx on verified_actions (player, creditcoin_block desc);
create index if not exists verified_actions_quest_idx on verified_actions (quest_id);

create table if not exists reward_releases (
  -- '{creditcoinTxHash}:{questId}': one release per quest per transaction.
  id text primary key,
  quest_id bigint not null,
  recipient text not null,
  amount numeric not null default 0,
  creditcoin_block bigint not null,
  creditcoin_tx_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists reward_releases_recipient_idx on reward_releases (recipient);

-- Academy progress, one row per address.
--
-- Off-chain convenience only. Reading a lesson and passing a quiz gate nothing: the badge comes
-- from a quest QuestASC verified, so a wiped or forged row here changes what the page shows and
-- nothing else.
create table if not exists academy_progress (
  player text primary key,
  -- { "<module slug>": { lessonsRead: number[], quizScore: number, quizPassed: boolean, updatedAt } }
  modules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Badges, indexed from BadgeMinted.
--
-- BadgeNFT is not enumerable, so an address's badges cannot be listed from the contract.
-- rarity_is_derived records where the rarity came from: v2 does not store one and it is computed
-- from the badge level by the published rule; v3 carries it on the event.
create table if not exists indexed_badges (
  token_id bigint primary key,
  player text not null,
  quest_id bigint not null,
  badge_level smallint not null,
  rarity smallint not null,
  rarity_is_derived boolean not null default true,
  creditcoin_block bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists indexed_badges_player_idx on indexed_badges (player, token_id desc);

-- Arena, Loot, Equipment, and Marketplace, indexed from Creditcoin's own events.
--
-- None of these tables is authoritative. Every row exists because the chain emitted the event, and
-- all of them rebuild by rewinding the indexer cursor. They exist because a challenge board, a
-- duel replay, and a market cannot be assembled from per-request contract calls.
--
-- Inventory and equipped loadouts are deliberately absent: an ERC-1155 balance changes through
-- transfers this indexer does not watch, so those are read live from the contract instead of
-- reconstructed here, where they could silently drift.

create table if not exists arena_challenges (
  challenge_id bigint primary key,
  challenger text not null,
  opponent text not null,
  stake numeric not null default 0,
  -- open, accepted, resolved, drawn, expired, cancelled
  status text not null,
  winner text,
  payout numeric,
  burned numeric,
  seed text,
  -- The round log as hex: three bytes per swing, attacker slot with the crit flag then damage.
  rounds text,
  opened_at_block bigint not null,
  accepted_at_block bigint,
  resolved_at_block bigint,
  updated_at timestamptz not null default now()
);

create index if not exists arena_challenges_challenger_idx on arena_challenges (challenger, challenge_id desc);
create index if not exists arena_challenges_opponent_idx on arena_challenges (opponent, challenge_id desc);
create index if not exists arena_challenges_status_idx on arena_challenges (status, challenge_id desc);

create table if not exists loot_drops (
  -- '{txHash}:{logIndex}': one player can win two items in one transaction.
  id text primary key,
  player text not null,
  item_id bigint not null,
  rarity smallint not null,
  -- 'raid' or 'arena'
  reason text not null,
  season_id bigint,
  share_bps integer,
  creditcoin_block bigint not null,
  creditcoin_tx_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists loot_drops_player_idx on loot_drops (player, creditcoin_block desc);

create table if not exists equipment_events (
  id text primary key,
  hero_token_id bigint not null,
  slot smallint not null,
  item_id bigint not null,
  owner text not null,
  equipped boolean not null,
  creditcoin_block bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists equipment_events_hero_idx on equipment_events (hero_token_id, creditcoin_block desc);

create table if not exists market_listings (
  listing_id bigint primary key,
  seller text not null,
  item_id bigint not null,
  amount integer not null,
  price numeric not null default 0,
  -- active, sold, cancelled
  status text not null,
  buyer text,
  fee numeric,
  listed_at_block bigint not null,
  closed_at_block bigint,
  updated_at timestamptz not null default now()
);

create index if not exists market_listings_status_idx on market_listings (status, listing_id desc);
create index if not exists market_listings_seller_idx on market_listings (seller, listing_id desc);

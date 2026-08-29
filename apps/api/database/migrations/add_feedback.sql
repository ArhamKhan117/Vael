-- Community feedback, shown on the landing page and at /feedback.
--
-- The route has always read and written this table, but no migration ever created it, so a fresh
-- database answered every feedback request with "Could not find the table 'public.feedback'" and
-- the landing page logged a 500 on every load. Columns are taken from what the route actually
-- reads and writes.

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text,
  role text,
  wallet_address text,
  username text,
  rating smallint not null check (rating between 1 and 5),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on feedback (created_at desc);
create index if not exists feedback_user_idx on feedback (user_id);

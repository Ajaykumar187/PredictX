create table if not exists leaderboard (
  email       text primary key,
  username    text not null unique,
  token_hash  text not null,
  total_value numeric not null,
  return_pct  numeric not null,
  updated_at  timestamptz not null default now()
);

create table if not exists digest_subscribers (
  email       text primary key,
  token_hash  text not null,
  watchlist   jsonb not null default '[]',
  enabled     boolean not null default false,
  confirmed   boolean not null default false,
  last_sent   timestamptz,
  created_at  timestamptz not null default now()
);

alter table digest_subscribers add column if not exists confirmed boolean not null default false;

alter table leaderboard enable row level security;
alter table digest_subscribers enable row level security;

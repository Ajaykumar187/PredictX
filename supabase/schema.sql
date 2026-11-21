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

create table if not exists auth_users (
  id                   text primary key,
  email                text not null unique,
  username             text not null unique,
  password_hash        text not null,
  password_salt        text not null,
  phone                text not null default '',
  email_alerts_enabled boolean not null default true,
  sms_alerts_enabled   boolean not null default false,
  logins               jsonb not null default '[]',
  created_at           timestamptz not null default now()
);

alter table auth_users enable row level security;

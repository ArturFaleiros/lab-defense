-- Mesmo esquema da migração "labdefense_core" aplicada no Supabase (usado nos testes locais com PGlite).
create schema if not exists labdefense;

create table if not exists labdefense.players (
  id            uuid primary key default gen_random_uuid(),
  nick          text not null check (char_length(nick) between 3 and 16),
  nick_key      text not null unique,
  token_hash    bytea not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  created_ip    inet,
  last_ip       inet,
  banned        boolean not null default false,
  ban_reason    text
);
create table if not exists labdefense.player_ips (
  player_id   uuid not null references labdefense.players(id) on delete cascade,
  ip          inet not null,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  hits        integer not null default 1,
  primary key (player_id, ip)
);
create table if not exists labdefense.profiles (
  player_id   uuid primary key references labdefense.players(id) on delete cascade,
  data        jsonb not null,
  rev         integer not null default 0,
  updated_at  timestamptz not null default now()
);
create table if not exists labdefense.matches (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references labdefense.players(id) on delete cascade,
  stage_id       text not null,
  difficulty     text,
  seed           bigint not null,
  loadout        jsonb not null,
  status         text not null default 'open' check (status in ('open','verified','rejected','abandoned','expired')),
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  sim_steps      integer,
  result         jsonb,
  reject_reason  text,
  ip             inet
);
create table if not exists labdefense.events (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  ip         inet,
  player_id  uuid references labdefense.players(id) on delete set null,
  kind       text not null,
  detail     jsonb
);
create table if not exists labdefense.ip_bans (
  ip          inet primary key,
  reason      text,
  created_at  timestamptz not null default now()
);

-- 90x — Esquema base (PostgreSQL / Supabase)
-- Economía 100% virtual. Sin dinero real.

create type app_role        as enum ('user','admin');
create type league_status   as enum ('open','locked','finished');
create type match_status    as enum ('scheduled','live','finished','cancelled');
create type bet_status      as enum ('pending','won','lost','void','cashout');
create type market_type     as enum ('match_winner','double_chance','over_under','btts',
                                     'corners','cards','shots','player_goal','player_card','custom');

-- USERS / PROFILE -----------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  bankroll     bigint not null default 10000,   -- tokens
  total_won    bigint not null default 0,
  rescues_used int    not null default 0,
  created_at   timestamptz not null default now()
);

create table public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role    app_role not null,
  unique (user_id, role)
);

-- LEAGUES -------------------------------------------------------------------
create table public.leagues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  invite_code   text unique not null,
  tournament_id text not null,                  -- ej. "fifa-wc-2026"
  owner_id      uuid not null references auth.users(id),
  starting_bankroll bigint not null default 10000,
  status        league_status not null default 'open',
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);

create table public.league_members (
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  bankroll   bigint not null default 10000,     -- ranking se calcula con este campo
  joined_at  timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index on public.league_members (league_id, bankroll desc);

-- MATCHES & MARKETS ---------------------------------------------------------
create table public.matches (
  id            text primary key,               -- id de la API deportiva
  tournament_id text not null,
  home_team     jsonb not null,                 -- {name, short, crest}
  away_team     jsonb not null,
  kickoff_at    timestamptz not null,
  status        match_status not null default 'scheduled',
  score         jsonb,                          -- {home, away, minute}
  stats         jsonb,                          -- posesión, córners, tarjetas, tiros…
  updated_at    timestamptz not null default now()
);
create index on public.matches (tournament_id, kickoff_at);

create table public.markets (
  id          uuid primary key default gen_random_uuid(),
  match_id    text not null references public.matches(id) on delete cascade,
  type        market_type not null,
  label       text not null,                    -- "Córners +9.5"
  selection   text not null,                    -- "over" | "home" | "player:messi" …
  odds        numeric(6,2) not null check (odds > 1),
  is_open     boolean not null default true,
  result      text,                             -- "won" | "lost" | "void"
  resolved_at timestamptz
);
create index on public.markets (match_id, is_open);

-- BETS ----------------------------------------------------------------------
create table public.bets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  league_id   uuid not null references public.leagues(id) on delete cascade,
  stake       bigint not null check (stake > 0),
  combined_odds numeric(10,2) not null,
  status      bet_status not null default 'pending',
  payout      bigint not null default 0,
  placed_at   timestamptz not null default now(),
  resolved_at timestamptz
);
create index on public.bets (user_id, status);
create index on public.bets (league_id, status);

create table public.bet_legs (
  id         uuid primary key default gen_random_uuid(),
  bet_id     uuid not null references public.bets(id) on delete cascade,
  market_id  uuid not null references public.markets(id),
  odds       numeric(6,2) not null,
  result     text                                -- "won" | "lost" | "void" | null
);

-- GRANTS --------------------------------------------------------------------
grant select, insert, update on public.profiles       to authenticated;
grant select                 on public.user_roles     to authenticated;
grant select, insert, update on public.leagues        to authenticated;
grant select, insert, delete on public.league_members to authenticated;
grant select                 on public.matches        to authenticated, anon;
grant select                 on public.markets        to authenticated, anon;
grant select, insert         on public.bets           to authenticated;
grant select, insert         on public.bet_legs       to authenticated;
grant all on all tables in schema public to service_role;

-- RLS -----------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.user_roles     enable row level security;
alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;
alter table public.bets           enable row level security;
alter table public.bet_legs       enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "profile self read"   on public.profiles for select using (auth.uid() = id);
create policy "profile self update" on public.profiles for update using (auth.uid() = id);

create policy "leagues visible to members" on public.leagues for select using (
  exists (select 1 from public.league_members lm where lm.league_id = id and lm.user_id = auth.uid())
);
create policy "user can create league" on public.leagues for insert with check (auth.uid() = owner_id);

create policy "members see members" on public.league_members for select using (
  exists (select 1 from public.league_members lm where lm.league_id = league_members.league_id and lm.user_id = auth.uid())
);
create policy "self join league" on public.league_members for insert with check (auth.uid() = user_id);

create policy "own bets read"   on public.bets for select using (auth.uid() = user_id);
create policy "league bets read" on public.bets for select using (
  exists (select 1 from public.league_members lm where lm.league_id = bets.league_id and lm.user_id = auth.uid())
);
create policy "own bets insert" on public.bets for insert with check (auth.uid() = user_id);

create policy "own bet legs read"   on public.bet_legs for select using (
  exists (select 1 from public.bets b where b.id = bet_id and b.user_id = auth.uid())
);
create policy "own bet legs insert" on public.bet_legs for insert with check (
  exists (select 1 from public.bets b where b.id = bet_id and b.user_id = auth.uid())
);

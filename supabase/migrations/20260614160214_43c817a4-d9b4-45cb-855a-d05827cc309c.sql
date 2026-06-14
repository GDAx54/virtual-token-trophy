
-- Enums
create type public.app_role      as enum ('user','admin');
create type public.league_status as enum ('open','locked','finished');
create type public.match_status  as enum ('scheduled','live','finished','cancelled');
create type public.bet_status    as enum ('pending','won','lost','void');

-- ============ profiles ============
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  bankroll     bigint not null default 10000,
  total_won    bigint not null default 0,
  rescues_used int    not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by everyone" on public.profiles for select using (true);
create policy "profiles self update"          on public.profiles for update using (auth.uid() = id);
create policy "profiles self insert"          on public.profiles for insert with check (auth.uid() = id);

-- ============ user_roles ============
create table public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role    public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "user_roles self read" on public.user_roles for select using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ============ leagues ============
create table public.leagues (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  invite_code       text unique not null default upper(substr(md5(random()::text), 1, 6)),
  tournament_id     text not null default 'fifa-wc-2026',
  owner_id          uuid not null references auth.users(id),
  starting_bankroll bigint not null default 10000,
  status            public.league_status not null default 'open',
  created_at        timestamptz not null default now()
);
grant select, insert, update on public.leagues to authenticated;
grant all on public.leagues to service_role;
alter table public.leagues enable row level security;
create policy "leagues readable to all auth" on public.leagues for select to authenticated using (true);
create policy "leagues insert by owner"      on public.leagues for insert to authenticated with check (auth.uid() = owner_id);
create policy "leagues update by owner"      on public.leagues for update to authenticated using (auth.uid() = owner_id);

-- ============ league_members ============
create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  bankroll  bigint not null default 10000,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index on public.league_members (league_id, bankroll desc);
grant select, insert, update, delete on public.league_members to authenticated;
grant all on public.league_members to service_role;
alter table public.league_members enable row level security;

create or replace function public.is_league_member(_league uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members where league_id = _league and user_id = _user)
$$;

create policy "members see co-members" on public.league_members for select to authenticated
  using (public.is_league_member(league_id, auth.uid()));
create policy "self join league"       on public.league_members for insert to authenticated
  with check (auth.uid() = user_id);

-- ============ matches ============
create table public.matches (
  id            text primary key,
  tournament_id text not null default 'fifa-wc-2026',
  home_team     jsonb not null,
  away_team     jsonb not null,
  kickoff_at    timestamptz not null,
  status        public.match_status not null default 'scheduled',
  score         jsonb,
  stats         jsonb,
  updated_at    timestamptz not null default now()
);
create index on public.matches (tournament_id, kickoff_at);
grant select on public.matches to authenticated, anon;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "matches public read" on public.matches for select using (true);

-- ============ markets ============
create table public.markets (
  id          uuid primary key default gen_random_uuid(),
  match_id    text not null references public.matches(id) on delete cascade,
  category    text not null,                          -- '1X2' | 'Córners' | 'Tarjetas' | 'Goleadores'
  label       text not null,
  selection   text not null,
  odds        numeric(6,2) not null check (odds > 1),
  is_open     boolean not null default true,
  result      text,
  resolved_at timestamptz
);
create index on public.markets (match_id, is_open);
grant select on public.markets to authenticated, anon;
grant all on public.markets to service_role;
alter table public.markets enable row level security;
create policy "markets public read" on public.markets for select using (true);

-- ============ bets ============
create table public.bets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  league_id     uuid references public.leagues(id) on delete set null,
  stake         bigint not null check (stake > 0),
  combined_odds numeric(10,2) not null,
  potential_payout bigint not null,
  status        public.bet_status not null default 'pending',
  payout        bigint not null default 0,
  placed_at     timestamptz not null default now(),
  resolved_at   timestamptz
);
create index on public.bets (user_id, status, placed_at desc);
create index on public.bets (league_id, status);
grant select, insert on public.bets to authenticated;
grant all on public.bets to service_role;
alter table public.bets enable row level security;
create policy "bets self read"  on public.bets for select to authenticated using (auth.uid() = user_id);
create policy "bets league read" on public.bets for select to authenticated
  using (league_id is not null and public.is_league_member(league_id, auth.uid()));
create policy "bets self insert" on public.bets for insert to authenticated with check (auth.uid() = user_id);

-- ============ bet_legs ============
create table public.bet_legs (
  id         uuid primary key default gen_random_uuid(),
  bet_id     uuid not null references public.bets(id) on delete cascade,
  market_id  uuid not null references public.markets(id),
  match_id   text not null references public.matches(id),
  label      text not null,
  odds       numeric(6,2) not null,
  result     text
);
create index on public.bet_legs (bet_id);
grant select, insert on public.bet_legs to authenticated;
grant all on public.bet_legs to service_role;
alter table public.bet_legs enable row level security;
create policy "bet_legs self read" on public.bet_legs for select to authenticated
  using (exists (select 1 from public.bets b where b.id = bet_id and (b.user_id = auth.uid()
                                                                      or (b.league_id is not null
                                                                          and public.is_league_member(b.league_id, auth.uid())))));
create policy "bet_legs self insert" on public.bet_legs for insert to authenticated
  with check (exists (select 1 from public.bets b where b.id = bet_id and b.user_id = auth.uid()));

-- ============ Trigger: auto-create profile on signup ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(new.raw_user_meta_data->>'full_name',
                          new.raw_user_meta_data->>'name',
                          split_part(new.email, '@', 1));
  v_username text := lower(regexp_replace(coalesce(v_name, 'player'), '[^a-zA-Z0-9_]', '', 'g'));
begin
  -- ensure uniqueness
  if exists (select 1 from public.profiles where username = v_username) then
    v_username := v_username || substr(md5(new.id::text), 1, 4);
  end if;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, v_username, v_name, new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ RPC: place_bet (atomic) ============
create or replace function public.place_bet(
  _league_id uuid,
  _market_ids uuid[],
  _stake bigint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bet_id uuid;
  v_combined numeric(10,2) := 1;
  v_payout bigint;
  v_bankroll bigint;
  m record;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if _stake <= 0 then raise exception 'stake must be positive'; end if;
  if array_length(_market_ids, 1) is null then raise exception 'no markets selected'; end if;

  -- balance check
  select bankroll into v_bankroll from public.profiles where id = v_uid for update;
  if v_bankroll < _stake then raise exception 'insufficient bankroll'; end if;

  -- compute combined odds & validate markets open
  for m in select * from public.markets where id = any(_market_ids) loop
    if not m.is_open then raise exception 'market % is closed', m.id; end if;
    v_combined := v_combined * m.odds;
  end loop;

  v_payout := floor(_stake * v_combined);

  -- create bet
  insert into public.bets (user_id, league_id, stake, combined_odds, potential_payout)
  values (v_uid, _league_id, _stake, v_combined, v_payout)
  returning id into v_bet_id;

  -- legs
  insert into public.bet_legs (bet_id, market_id, match_id, label, odds)
  select v_bet_id, mk.id, mk.match_id, mk.category || ' · ' || mk.label, mk.odds
    from public.markets mk where mk.id = any(_market_ids);

  -- debit bankroll (profile + league_member if applicable)
  update public.profiles set bankroll = bankroll - _stake where id = v_uid;
  if _league_id is not null then
    update public.league_members set bankroll = bankroll - _stake
      where league_id = _league_id and user_id = v_uid;
  end if;

  return v_bet_id;
end;
$$;
grant execute on function public.place_bet(uuid, uuid[], bigint) to authenticated;

-- ============ Realtime ============
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.league_members;
alter publication supabase_realtime add table public.bets;


-- Auto-add league owner as member on creation
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.league_members (league_id, user_id, bankroll)
    values (new.id, new.owner_id, new.starting_bankroll)
    on conflict do nothing;
  return new;
end; $$;

drop trigger if exists leagues_add_owner_member on public.leagues;
create trigger leagues_add_owner_member
  after insert on public.leagues
  for each row execute function public.add_owner_as_member();

-- Join league via invite code
create or replace function public.join_league_by_code(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_league_id uuid; v_starting bigint;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  select id, starting_bankroll into v_league_id, v_starting
    from public.leagues where upper(invite_code) = upper(trim(_code));
  if v_league_id is null then raise exception 'liga no encontrada'; end if;
  insert into public.league_members (league_id, user_id, bankroll)
    values (v_league_id, v_uid, v_starting)
    on conflict (league_id, user_id) do nothing;
  return v_league_id;
end; $$;

revoke all on function public.join_league_by_code(text) from public, anon;
grant execute on function public.join_league_by_code(text) to authenticated;

-- Allow anyone authenticated to look up a league by invite code
drop policy if exists "leagues lookup by code" on public.leagues;

-- place_bet: require league_id, use league_members.bankroll only
create or replace function public.place_bet(_league_id uuid, _market_ids uuid[], _stake bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bet_id uuid;
  v_combined numeric(10,2) := 1;
  v_payout bigint;
  v_bankroll bigint;
  m record;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  if _league_id is null then raise exception 'debes elegir una liga'; end if;
  if _stake <= 0 then raise exception 'stake invalido'; end if;
  if array_length(_market_ids,1) is null then raise exception 'sin mercados'; end if;

  select bankroll into v_bankroll from public.league_members
    where league_id = _league_id and user_id = v_uid for update;
  if v_bankroll is null then raise exception 'no perteneces a esta liga'; end if;
  if v_bankroll < _stake then raise exception 'saldo insuficiente'; end if;

  for m in select * from public.markets where id = any(_market_ids) loop
    if not m.is_open then raise exception 'mercado cerrado'; end if;
    v_combined := v_combined * m.odds;
  end loop;

  v_payout := floor(_stake * v_combined);

  insert into public.bets (user_id, league_id, stake, combined_odds, potential_payout)
    values (v_uid, _league_id, _stake, v_combined, v_payout) returning id into v_bet_id;

  insert into public.bet_legs (bet_id, market_id, match_id, label, odds)
    select v_bet_id, mk.id, mk.match_id, mk.category || ' · ' || mk.label, mk.odds
      from public.markets mk where mk.id = any(_market_ids);

  update public.league_members set bankroll = bankroll - _stake
    where league_id = _league_id and user_id = v_uid;

  return v_bet_id;
end; $$;

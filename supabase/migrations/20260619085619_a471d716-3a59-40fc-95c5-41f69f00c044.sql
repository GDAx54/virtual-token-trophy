create or replace function public.settle_match(_match_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home int;
  v_away int;
  v_winner text;
  v_status match_status;
  v_resolved int := 0;
  b record;
  all_won boolean;
  any_lost boolean;
  pending_legs int;
begin
  select status, (score->>'home')::int, (score->>'away')::int
    into v_status, v_home, v_away
  from public.matches where id = _match_id;

  if v_status is null then raise exception 'match % not found', _match_id; end if;
  if v_status <> 'finished' then return 0; end if;
  if v_home is null or v_away is null then return 0; end if;

  v_winner := case when v_home > v_away then 'home'
                   when v_home < v_away then 'away'
                   else 'draw' end;

  update public.markets
     set result = case when selection = v_winner then 'won' else 'lost' end,
         is_open = false, resolved_at = now()
   where match_id = _match_id and category = '1X2' and result is null;

  update public.markets
     set result = 'void', is_open = false, resolved_at = now()
   where match_id = _match_id and category <> '1X2' and result is null;

  update public.bet_legs bl
     set result = m.result
    from public.markets m
   where bl.market_id = m.id and bl.match_id = _match_id and bl.result is null;

  for b in
    select distinct bt.id, bt.user_id, bt.league_id, bt.stake
      from public.bets bt
      join public.bet_legs bl on bl.bet_id = bt.id
     where bt.status = 'pending' and bl.match_id = _match_id
  loop
    select count(*) filter (where result is null) into pending_legs
      from public.bet_legs where bet_id = b.id;
    if pending_legs > 0 then continue; end if;

    select bool_and(result = 'won' or result = 'void'),
           bool_or (result = 'lost')
      into all_won, any_lost
    from public.bet_legs where bet_id = b.id;

    if any_lost then
      update public.bets set status='lost', payout=0, resolved_at=now() where id=b.id;
    elsif all_won then
      declare v_eff numeric(10,2); v_payout bigint;
      begin
        select coalesce(exp(sum(ln(case when result='void' then 1 else odds end))), 1)
          into v_eff from public.bet_legs where bet_id = b.id;
        v_payout := floor(b.stake * v_eff);
        update public.bets set status='won', payout=v_payout, combined_odds=v_eff, resolved_at=now() where id=b.id;
        update public.profiles set bankroll=bankroll+v_payout, total_won=total_won+(v_payout-b.stake) where id=b.user_id;
        if b.league_id is not null then
          update public.league_members set bankroll=bankroll+v_payout
            where league_id=b.league_id and user_id=b.user_id;
        end if;
      end;
    end if;
    v_resolved := v_resolved + 1;
  end loop;

  return v_resolved;
end;
$$;
revoke all on function public.settle_match(text) from public, anon, authenticated;
grant execute on function public.settle_match(text) to service_role;

create or replace function public.upsert_match(
  _id text, _tournament text, _home jsonb, _away jsonb,
  _kickoff timestamptz, _status match_status, _score jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.matches (id, tournament_id, home_team, away_team, kickoff_at, status, score, updated_at)
  values (_id, _tournament, _home, _away, _kickoff, _status, _score, now())
  on conflict (id) do update
    set status = excluded.status,
        score  = excluded.score,
        kickoff_at = excluded.kickoff_at,
        updated_at = now();

  if not exists (select 1 from public.markets where match_id = _id and category = '1X2') then
    insert into public.markets (match_id, category, label, selection, odds) values
      (_id, '1X2',      _home->>'name' || ' gana', 'home', 2.10),
      (_id, '1X2',      'Empate',                  'draw', 3.30),
      (_id, '1X2',      _away->>'name' || ' gana', 'away', 2.80),
      (_id, 'Córners',  'Córners +9.5',  'over',  1.85),
      (_id, 'Córners',  'Córners -9.5',  'under', 1.85),
      (_id, 'Tarjetas', 'Tarjetas +4.5', 'over',  1.95),
      (_id, 'Tarjetas', 'Tarjetas -4.5', 'under', 1.75);
  end if;
end;
$$;
revoke all on function public.upsert_match(text,text,jsonb,jsonb,timestamptz,match_status,jsonb) from public, anon, authenticated;
grant execute on function public.upsert_match(text,text,jsonb,jsonb,timestamptz,match_status,jsonb) to service_role;
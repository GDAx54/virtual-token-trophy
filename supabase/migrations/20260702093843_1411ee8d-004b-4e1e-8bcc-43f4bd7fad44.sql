CREATE OR REPLACE FUNCTION public.upsert_match(_id text, _tournament text, _home jsonb, _away jsonb, _kickoff timestamp with time zone, _status match_status, _score jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.matches (id, tournament_id, home_team, away_team, kickoff_at, status, score, updated_at)
  values (_id, _tournament, _home, _away, _kickoff, _status, _score, now())
  on conflict (id) do update
    set home_team = excluded.home_team,
        away_team = excluded.away_team,
        status = excluded.status,
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

  -- Refresca las etiquetas de los mercados 1X2 cuando cambian los nombres de los equipos
  update public.markets
     set label = _home->>'name' || ' gana'
   where match_id = _id and category = '1X2' and selection = 'home';
  update public.markets
     set label = _away->>'name' || ' gana'
   where match_id = _id and category = '1X2' and selection = 'away';
end;
$function$;
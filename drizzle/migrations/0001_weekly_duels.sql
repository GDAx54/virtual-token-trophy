ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS period_start timestamptz;

CREATE OR REPLACE FUNCTION public.week_start(_t timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT (date_trunc('week', _t AT TIME ZONE 'Europe/Madrid')) AT TIME ZONE 'Europe/Madrid'
$$;

CREATE OR REPLACE FUNCTION public.bet_legs_set_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.bets b SET period_start = public.week_start(
    (SELECT max(m.kickoff_at) FROM public.bet_legs bl JOIN public.matches m ON m.id = bl.match_id WHERE bl.bet_id = b.id))
  WHERE b.id = NEW.bet_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bet_legs_period ON public.bet_legs;
CREATE TRIGGER bet_legs_period AFTER INSERT ON public.bet_legs FOR EACH ROW EXECUTE FUNCTION public.bet_legs_set_period();

UPDATE public.bets b SET period_start = public.week_start(
  (SELECT max(m.kickoff_at) FROM public.bet_legs bl JOIN public.matches m ON m.id = bl.match_id WHERE bl.bet_id = b.id))
WHERE period_start IS NULL;

CREATE INDEX IF NOT EXISTS bets_league_user_period ON public.bets (league_id, user_id, period_start);

CREATE TABLE public.league_ranks (
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rank smallint NOT NULL DEFAULT 0 CHECK (rank BETWEEN 0 AND 4),
  wins int NOT NULL DEFAULT 0,
  losses int NOT NULL DEFAULT 0,
  draws int NOT NULL DEFAULT 0,
  win_streak int NOT NULL DEFAULT 0,
  byes int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);
GRANT SELECT ON public.league_ranks TO authenticated;
GRANT ALL ON public.league_ranks TO service_role;
ALTER TABLE public.league_ranks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ranks league read" ON public.league_ranks FOR SELECT TO authenticated
  USING (public.is_league_member(league_id, auth.uid()));

CREATE TABLE public.weekly_duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  player_a uuid NOT NULL,
  player_b uuid,
  ref_a bigint NOT NULL,
  ref_b bigint,
  net_a bigint, net_b bigint,
  ret_a numeric, ret_b numeric,
  played_a boolean, played_b boolean,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','pending','finished','void','bye')),
  outcome text CHECK (outcome IN ('win','draw','walkover','void','bye')),
  winner uuid,
  rank_before_a smallint, rank_after_a smallint,
  rank_before_b smallint, rank_after_b smallint,
  taunt text CHECK (taunt IS NULL OR char_length(taunt) <= 100),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX weekly_duels_a ON public.weekly_duels (league_id, period_key, player_a);
CREATE UNIQUE INDEX weekly_duels_b ON public.weekly_duels (league_id, period_key, player_b) WHERE player_b IS NOT NULL;
CREATE INDEX weekly_duels_status ON public.weekly_duels (status, period_end);
GRANT SELECT ON public.weekly_duels TO authenticated;
GRANT ALL ON public.weekly_duels TO service_role;
ALTER TABLE public.weekly_duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duels league read" ON public.weekly_duels FOR SELECT TO authenticated
  USING (public.is_league_member(league_id, auth.uid()));

CREATE TABLE public.duel_reactions (
  duel_id uuid NOT NULL REFERENCES public.weekly_duels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (duel_id, user_id)
);
GRANT SELECT ON public.duel_reactions TO authenticated;
GRANT ALL ON public.duel_reactions TO service_role;
ALTER TABLE public.duel_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions league read" ON public.duel_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.weekly_duels d WHERE d.id = duel_id AND public.is_league_member(d.league_id, auth.uid())));

CREATE OR REPLACE FUNCTION public.duel_perf(_league uuid, _user uuid, _start timestamptz,
  OUT net bigint, OUT valid int, OUT pending int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(sum(CASE WHEN status = 'won' THEN payout - stake WHEN status = 'lost' THEN -stake ELSE 0 END), 0)::bigint,
         (count(*) FILTER (WHERE status IN ('won','lost')))::int,
         (count(*) FILTER (WHERE status = 'pending'))::int
    FROM public.bets WHERE league_id = _league AND user_id = _user AND period_start = _start
$$;

CREATE OR REPLACE FUNCTION public.duel_apply_rank(_league uuid, _user uuid, _delta int, OUT before smallint, OUT after smallint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.league_ranks (league_id, user_id) VALUES (_league, _user) ON CONFLICT DO NOTHING;
  SELECT rank INTO before FROM public.league_ranks WHERE league_id = _league AND user_id = _user FOR UPDATE;
  after := least(4, greatest(0, before + _delta));
  UPDATE public.league_ranks SET rank = after,
    wins = wins + (CASE WHEN _delta > 0 THEN 1 ELSE 0 END),
    losses = losses + (CASE WHEN _delta < 0 THEN 1 ELSE 0 END),
    draws = draws + (CASE WHEN _delta = 0 THEN 1 ELSE 0 END),
    win_streak = CASE WHEN _delta > 0 THEN win_streak + 1 ELSE 0 END,
    updated_at = now()
  WHERE league_id = _league AND user_id = _user;
END $$;

CREATE OR REPLACE FUNCTION public.create_weekly_duels()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  ws timestamptz := public.week_start(now());
  we timestamptz := ws + interval '7 days';
  pk text := to_char(ws AT TIME ZONE 'Europe/Madrid', 'IYYY-"W"IW');
  lg record; ids uuid[]; refs bigint[]; n int; i int; j int; pick int; bye_idx int;
  used boolean[]; prev uuid; total int := 0;
BEGIN
  IF now() > ws + interval '6 hours' THEN RETURN 0; END IF;
  FOR lg IN SELECT id FROM public.leagues l
             WHERE NOT EXISTS (SELECT 1 FROM public.weekly_duels d WHERE d.league_id = l.id AND d.period_key = pk)
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext(lg.id::text || pk));
    IF EXISTS (SELECT 1 FROM public.weekly_duels d WHERE d.league_id = lg.id AND d.period_key = pk) THEN CONTINUE; END IF;
    INSERT INTO public.league_ranks (league_id, user_id)
      SELECT lg.id, user_id FROM public.league_members WHERE league_id = lg.id ON CONFLICT DO NOTHING;
    SELECT array_agg(x.user_id ORDER BY x.rank DESC, x.ref DESC, x.user_id), array_agg(x.ref ORDER BY x.rank DESC, x.ref DESC, x.user_id)
      INTO ids, refs
      FROM (SELECT lm.user_id, r.rank,
                   lm.bankroll + coalesce((SELECT sum(stake) FROM public.bets b WHERE b.league_id = lg.id
                       AND b.user_id = lm.user_id AND b.status = 'pending' AND b.period_start = ws), 0) AS ref
              FROM public.league_members lm JOIN public.league_ranks r ON r.league_id = lm.league_id AND r.user_id = lm.user_id
             WHERE lm.league_id = lg.id) x
     WHERE x.ref > 0;
    n := coalesce(array_length(ids, 1), 0);
    IF n = 0 THEN CONTINUE; END IF;
    used := array_fill(false, ARRAY[n]);
    IF n % 2 = 1 THEN
      SELECT t.idx INTO bye_idx FROM unnest(ids) WITH ORDINALITY t(uid, idx)
        JOIN public.league_ranks r ON r.league_id = lg.id AND r.user_id = t.uid
       ORDER BY r.byes ASC, t.idx DESC LIMIT 1;
      used[bye_idx] := true;
      INSERT INTO public.weekly_duels (league_id, period_key, period_start, period_end, player_a, ref_a, status, outcome, resolved_at)
        VALUES (lg.id, pk, ws, we, ids[bye_idx], refs[bye_idx], 'bye', 'bye', now());
      UPDATE public.league_ranks SET byes = byes + 1 WHERE league_id = lg.id AND user_id = ids[bye_idx];
    END IF;
    FOR i IN 1..n LOOP
      IF used[i] THEN CONTINUE; END IF;
      used[i] := true;
      prev := NULL;
      SELECT CASE WHEN d.player_a = ids[i] THEN d.player_b ELSE d.player_a END INTO prev
        FROM public.weekly_duels d WHERE d.league_id = lg.id AND d.period_start < ws AND d.player_b IS NOT NULL
         AND (d.player_a = ids[i] OR d.player_b = ids[i]) ORDER BY d.period_start DESC LIMIT 1;
      pick := NULL;
      FOR j IN i+1..n LOOP
        IF NOT used[j] AND ids[j] IS DISTINCT FROM prev THEN pick := j; EXIT; END IF;
      END LOOP;
      IF pick IS NULL THEN
        FOR j IN i+1..n LOOP IF NOT used[j] THEN pick := j; EXIT; END IF; END LOOP;
      END IF;
      IF pick IS NULL THEN CONTINUE; END IF;
      used[pick] := true;
      INSERT INTO public.weekly_duels (league_id, period_key, period_start, period_end, player_a, player_b, ref_a, ref_b)
        VALUES (lg.id, pk, ws, we, ids[i], ids[pick], refs[i], refs[pick]);
      total := total + 1;
    END LOOP;
  END LOOP;
  RETURN total;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_weekly_duels()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d record; pa record; pb record; ra numeric; rb numeric; oka boolean; okb boolean;
  w uuid; oc text; x record; y record; cnt int := 0;
BEGIN
  FOR d IN SELECT id FROM public.weekly_duels WHERE status IN ('scheduled','pending') AND period_end <= now() LOOP
    SELECT * INTO d FROM public.weekly_duels WHERE id = d.id AND status IN ('scheduled','pending') FOR UPDATE SKIP LOCKED;
    IF d.id IS NULL THEN CONTINUE; END IF;
    pa := public.duel_perf(d.league_id, d.player_a, d.period_start);
    pb := public.duel_perf(d.league_id, d.player_b, d.period_start);
    IF pa.pending + pb.pending > 0 THEN
      UPDATE public.weekly_duels SET status = 'pending', net_a = pa.net, net_b = pb.net WHERE id = d.id;
      CONTINUE;
    END IF;
    oka := d.ref_a > 0 AND pa.valid > 0;
    okb := coalesce(d.ref_b, 0) > 0 AND pb.valid > 0;
    ra := CASE WHEN oka THEN pa.net * 100.0 / d.ref_a END;
    rb := CASE WHEN okb THEN pb.net * 100.0 / d.ref_b END;
    w := NULL;
    IF NOT oka AND NOT okb THEN oc := 'void';
    ELSIF oka AND NOT okb THEN oc := 'walkover'; w := d.player_a;
    ELSIF okb AND NOT oka THEN oc := 'walkover'; w := d.player_b;
    ELSIF ra = rb THEN oc := 'draw';
    ELSIF ra > rb THEN oc := 'win'; w := d.player_a;
    ELSE oc := 'win'; w := d.player_b; END IF;

    IF oc = 'void' THEN
      UPDATE public.weekly_duels SET status = 'void', outcome = 'void', net_a = pa.net, net_b = pb.net,
        played_a = false, played_b = false, resolved_at = now() WHERE id = d.id;
    ELSE
      x := public.duel_apply_rank(d.league_id, d.player_a, CASE WHEN oc = 'draw' THEN 0 WHEN w = d.player_a THEN 1 ELSE -1 END);
      y := public.duel_apply_rank(d.league_id, d.player_b, CASE WHEN oc = 'draw' THEN 0 WHEN w = d.player_b THEN 1 ELSE -1 END);
      UPDATE public.weekly_duels SET status = 'finished', outcome = oc, winner = w,
        net_a = pa.net, net_b = pb.net, ret_a = ra, ret_b = rb, played_a = oka, played_b = okb,
        rank_before_a = x.before, rank_after_a = x.after, rank_before_b = y.before, rank_after_b = y.after,
        resolved_at = now() WHERE id = d.id;
    END IF;
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$;

CREATE OR REPLACE FUNCTION public.duel_live(_duel uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d record; pa record; pb record;
BEGIN
  SELECT * INTO d FROM public.weekly_duels WHERE id = _duel;
  IF d.id IS NULL OR NOT public.is_league_member(d.league_id, auth.uid()) THEN RAISE EXCEPTION 'sin acceso'; END IF;
  pa := public.duel_perf(d.league_id, d.player_a, d.period_start);
  pb := public.duel_perf(d.league_id, d.player_b, d.period_start);
  RETURN jsonb_build_object(
    'ret_a', CASE WHEN d.ref_a > 0 THEN pa.net * 100.0 / d.ref_a END, 'valid_a', pa.valid, 'pending_a', pa.pending,
    'ret_b', CASE WHEN coalesce(d.ref_b,0) > 0 THEN pb.net * 100.0 / d.ref_b END, 'valid_b', pb.valid, 'pending_b', pb.pending);
END $$;

CREATE OR REPLACE FUNCTION public.set_duel_taunt(_duel uuid, _text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t text := nullif(btrim(regexp_replace(coalesce(_text,''), '[[:cntrl:]]', '', 'g')), '');
BEGIN
  IF t IS NOT NULL AND char_length(t) > 100 THEN RAISE EXCEPTION 'máximo 100 caracteres'; END IF;
  UPDATE public.weekly_duels SET taunt = t
   WHERE id = _duel AND status = 'finished' AND winner = auth.uid() AND auth.uid() IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'solo el ganador puede escribir aquí'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.react_duel(_duel uuid, _emoji text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d record; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'no autenticado'; END IF;
  IF _emoji NOT IN ('🔥','💀','🤡','👏','😂') THEN RAISE EXCEPTION 'reacción no válida'; END IF;
  SELECT * INTO d FROM public.weekly_duels WHERE id = _duel;
  IF d.id IS NULL OR d.status <> 'finished' OR NOT public.is_league_member(d.league_id, v_uid) THEN RAISE EXCEPTION 'sin acceso'; END IF;
  IF EXISTS (SELECT 1 FROM public.duel_reactions WHERE duel_id = _duel AND user_id = v_uid AND emoji = _emoji) THEN
    DELETE FROM public.duel_reactions WHERE duel_id = _duel AND user_id = v_uid;
  ELSE
    INSERT INTO public.duel_reactions (duel_id, user_id, emoji) VALUES (_duel, v_uid, _emoji)
      ON CONFLICT (duel_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = now();
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.duel_perf(uuid, uuid, timestamptz), public.duel_apply_rank(uuid, uuid, int),
  public.create_weekly_duels(), public.resolve_weekly_duels(), public.bet_legs_set_period() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.duel_live(uuid), public.set_duel_taunt(uuid, text), public.react_duel(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duel_live(uuid), public.set_duel_taunt(uuid, text), public.react_duel(uuid, text) TO authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('weekly-duels') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-duels');
  PERFORM cron.schedule('weekly-duels', '0 * * * *', 'select public.create_weekly_duels(); select public.resolve_weekly_duels();');
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS referral_bonus bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.apply_referral(_ref_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ref_id uuid;
  v_already uuid;
  v_bonus constant bigint := 2000;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'no autenticado'; END IF;
  IF _ref_username IS NULL OR length(trim(_ref_username)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin código');
  END IF;

  SELECT referred_by INTO v_already FROM public.profiles WHERE id = v_uid;
  IF v_already IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya usaste un referido');
  END IF;

  SELECT id INTO v_ref_id FROM public.profiles
   WHERE lower(username) = lower(trim(_ref_username)) LIMIT 1;
  IF v_ref_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'usuario no encontrado');
  END IF;
  IF v_ref_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no puedes referirte a ti mismo');
  END IF;

  -- Marcar y bonificar al nuevo usuario
  UPDATE public.profiles
     SET referred_by = v_ref_id,
         referral_bonus = referral_bonus + v_bonus
   WHERE id = v_uid;
  UPDATE public.league_members SET bankroll = bankroll + v_bonus WHERE user_id = v_uid;

  -- Bonificar al invitador
  UPDATE public.profiles
     SET referral_bonus = referral_bonus + v_bonus
   WHERE id = v_ref_id;
  UPDATE public.league_members SET bankroll = bankroll + v_bonus WHERE user_id = v_ref_id;

  RETURN jsonb_build_object('ok', true, 'bonus', v_bonus, 'referrer', v_ref_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.apply_referral(text) TO authenticated;

-- Aplicar bono acumulado al unirse por código
CREATE OR REPLACE FUNCTION public.join_league_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_league_id uuid;
  v_starting bigint;
  v_bonus bigint := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'no autenticado'; END IF;
  SELECT id, starting_bankroll INTO v_league_id, v_starting
    FROM public.leagues WHERE upper(invite_code) = upper(trim(_code));
  IF v_league_id IS NULL THEN RAISE EXCEPTION 'liga no encontrada'; END IF;

  SELECT coalesce(referral_bonus, 0) INTO v_bonus FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.league_members (league_id, user_id, bankroll)
    VALUES (v_league_id, v_uid, v_starting + v_bonus)
    ON CONFLICT (league_id, user_id) DO NOTHING;
  RETURN v_league_id;
END; $$;

-- Aplicar bono acumulado al crear la liga (owner)
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_bonus bigint := 0;
BEGIN
  SELECT coalesce(referral_bonus, 0) INTO v_bonus FROM public.profiles WHERE id = NEW.owner_id;
  INSERT INTO public.league_members (league_id, user_id, bankroll)
    VALUES (NEW.id, NEW.owner_id, NEW.starting_bankroll + v_bonus)
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

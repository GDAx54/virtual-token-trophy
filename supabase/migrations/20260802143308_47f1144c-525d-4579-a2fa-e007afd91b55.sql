-- 1. profiles: restrict reads to authenticated users
DROP POLICY IF EXISTS "profiles readable by everyone" ON public.profiles;
CREATE POLICY "profiles readable by authenticated"
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles self insert" ON public.profiles;
CREATE POLICY "profiles self insert"
ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

REVOKE ALL ON public.profiles FROM anon;

-- user_roles: authenticated-only reads
DROP POLICY IF EXISTS "user_roles self read" ON public.user_roles;
CREATE POLICY "user_roles self read"
ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.user_roles FROM anon;

-- 2. leagues: only owner or members can read
DROP POLICY IF EXISTS "leagues readable to all auth" ON public.leagues;
CREATE POLICY "leagues readable to owner and members"
ON public.leagues FOR SELECT TO authenticated
USING (auth.uid() = owner_id OR public.is_league_member(id, auth.uid()));

-- 3. SECURITY DEFINER function execute grants
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_league_member(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_match(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_match(text, text, jsonb, jsonb, timestamptz, match_status, jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.add_owner_as_member() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_referral(text) FROM anon;
REVOKE ALL ON FUNCTION public.join_league_by_code(text) FROM anon;
REVOKE ALL ON FUNCTION public.place_bet(uuid, uuid[], bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, uuid[], bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_league_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_match(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_match(text, text, jsonb, jsonb, timestamptz, match_status, jsonb) TO service_role;
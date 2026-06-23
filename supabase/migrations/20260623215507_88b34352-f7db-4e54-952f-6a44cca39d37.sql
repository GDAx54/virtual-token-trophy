GRANT EXECUTE ON FUNCTION public.is_league_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.join_league_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_match(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_match(text, text, jsonb, jsonb, timestamptz, match_status, jsonb) TO service_role;
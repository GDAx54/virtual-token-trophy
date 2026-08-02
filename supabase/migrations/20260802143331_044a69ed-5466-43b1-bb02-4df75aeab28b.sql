REVOKE ALL ON FUNCTION public.apply_referral(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.place_bet(uuid, uuid[], bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_owner_as_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, uuid[], bigint) TO authenticated;
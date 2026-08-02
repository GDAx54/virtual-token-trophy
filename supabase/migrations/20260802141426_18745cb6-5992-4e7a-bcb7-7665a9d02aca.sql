CREATE POLICY "self leave league" ON public.league_members FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT DELETE ON public.league_members TO authenticated;
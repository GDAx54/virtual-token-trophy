import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Euro, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveLeague } from "@/hooks/use-active-league";

interface LeagueInfo { id: string; name: string; bankroll: number }

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const { user } = useSession();
  const { leagueId } = useActiveLeague();
  const [league, setLeague] = useState<LeagueInfo | null>(null);

  useEffect(() => {
    if (!user || !leagueId) { setLeague(null); return; }
    let cancelled = false;

    const load = async () => {
      const [{ data: m }, { data: l }] = await Promise.all([
        supabase.from("league_members").select("bankroll").eq("league_id", leagueId).eq("user_id", user.id).maybeSingle(),
        supabase.from("leagues").select("id, name").eq("id", leagueId).maybeSingle(),
      ]);
      if (cancelled || !l) return;
      setLeague({ id: l.id, name: l.name, bankroll: Number(m?.bankroll ?? 0) });
    };
    load();

    const channel = supabase
      .channel(`lm:${leagueId}:${user.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "league_members", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user, leagueId]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4">
        <Link to="/" className="min-w-0">
          <div className="text-lg font-bold tracking-tight">
            token<span className="text-neon">bet</span>
          </div>
          <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
            {subtitle ?? (league ? league.name : "Sin liga activa")}
          </p>
        </Link>

        {league ? (
          <div className="flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-3 py-1.5">
            <Euro className="h-4 w-4 text-neon" />
            <span className="text-sm font-bold text-neon">
              {league.bankroll.toLocaleString()}
            </span>
          </div>
        ) : (
          <Link
            to="/leagues"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Trophy className="h-3.5 w-3.5" /> Elegir liga
          </Link>
        )}
      </div>
    </header>
  );
}

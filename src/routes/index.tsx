import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveLeague } from "@/hooks/use-active-league";
import { RequireAuth } from "@/components/RequireAuth";
import { AppHeader } from "@/components/AppHeader";
import { TabBar } from "@/components/TabBar";
import { MatchCard, type MatchRow } from "@/components/MatchCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TokenBet — Apuestas sociales en euros virtuales" },
      { name: "description", content: "Compite con tus amigos en ligas privadas. 100% dinero virtual." },
    ],
  }),
  component: () => <RequireAuth><HomePage /></RequireAuth>,
});

function HomePage() {
  const { user } = useSession();
  const { leagueId } = useActiveLeague();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: rows, error } = await supabase
        .from("matches")
        .select("id, home_team, away_team, kickoff_at, status, score, markets(id, category, label, selection, odds)")
        .in("status", ["scheduled", "live"])
        .order("kickoff_at", { ascending: true });
      if (!mounted) return;
      if (error) toast.error(error.message);
      else setMatches((rows ?? []) as unknown as MatchRow[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const placeBet = async (p: { marketId: string; odds: number; label: string; stake: number }) => {
    if (!user) return;
    if (!leagueId) {
      toast.error("Elige una liga primero");
      return;
    }
    const { error } = await supabase.rpc("place_bet", {
      _league_id: leagueId,
      _market_ids: [p.marketId],
      _stake: p.stake,
    });
    if (error) {
      toast.error("No se pudo apostar", { description: error.message });
      return;
    }
    toast.success("¡Apuesta confirmada!", {
      description: `${p.label} @ ${p.odds.toFixed(2)} — ${p.stake} €`,
    });
  };

  return (
    <div className="min-h-screen pb-24">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 pt-6">
        {!leagueId && (
          <div className="mb-5 rounded-2xl border border-neon/30 bg-neon/10 p-5 text-center">
            <Trophy className="mx-auto h-8 w-8 text-neon" />
            <h2 className="mt-2 text-base font-bold">Aún no tienes una liga activa</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tus € van por liga: en cada una empiezas con tu propio saldo y compites contra tus amigos.
            </p>
            <Link to="/leagues" className="mt-3 inline-block rounded-lg bg-neon px-4 py-2 text-sm font-bold text-neon-foreground shadow-[var(--shadow-glow)]">
              Crear o unirse a una liga
            </Link>
          </div>
        )}

        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Partidos disponibles
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-card/40" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <p className="rounded-xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            No hay partidos disponibles ahora mismo.
          </p>
        ) : (
          <div className="space-y-4">
            {matches.map((m, i) => (
              <MatchCard key={m.id} match={m} hot={i === 0} onPlaceBet={placeBet} />
            ))}
          </div>
        )}
      </main>
      <TabBar />
    </div>
  );
}

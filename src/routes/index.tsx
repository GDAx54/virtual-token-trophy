import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { RequireAuth } from "@/components/RequireAuth";
import { AppHeader } from "@/components/AppHeader";
import { TabBar } from "@/components/TabBar";
import { MatchCard, type MatchRow } from "@/components/MatchCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TokenBet — Apuestas sociales con tokens virtuales" },
      { name: "description", content: "Compite con tus amigos en ligas privadas. 100% tokens virtuales, 0% dinero real." },
    ],
  }),
  component: () => <RequireAuth><HomePage /></RequireAuth>,
});

function HomePage() {
  const { user } = useSession();
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
    const { error } = await supabase.rpc("place_bet", {
      _league_id: null,
      _market_ids: [p.marketId],
      _stake: p.stake,
    });
    if (error) {
      toast.error("No se pudo apostar", { description: error.message });
      return;
    }
    toast.success("¡Apuesta confirmada!", {
      description: `${p.label} @ ${p.odds.toFixed(2)} — ${p.stake} tkn`,
    });
  };

  return (
    <div className="min-h-screen pb-24">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 pt-6">
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

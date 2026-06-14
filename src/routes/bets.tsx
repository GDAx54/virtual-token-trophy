import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { RequireAuth } from "@/components/RequireAuth";
import { AppHeader } from "@/components/AppHeader";
import { TabBar } from "@/components/TabBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bets")({
  head: () => ({
    meta: [
      { title: "Mis apuestas · TokenBet" },
      { name: "description", content: "Historial y apuestas activas." },
    ],
  }),
  component: () => <RequireAuth><BetsPage /></RequireAuth>,
});

interface BetRow {
  id: string;
  stake: number;
  combined_odds: number;
  potential_payout: number;
  status: "pending" | "won" | "lost" | "void";
  payout: number;
  placed_at: string;
  bet_legs: { label: string; odds: number }[];
}

function BetsPage() {
  const { user } = useSession();
  const [bets, setBets] = useState<BetRow[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("bets")
        .select("id, stake, combined_odds, potential_payout, status, payout, placed_at, bet_legs(label, odds)")
        .eq("user_id", user.id)
        .order("placed_at", { ascending: false })
        .limit(50);
      if (!cancelled && data) setBets(data as unknown as BetRow[]);
    };
    load();
    const channel = supabase
      .channel(`bets:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="min-h-screen pb-24">
      <AppHeader subtitle="Historial de apuestas" />
      <main className="mx-auto max-w-3xl px-5 pt-6">
        {bets.length === 0 ? (
          <p className="rounded-xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            Aún no has hecho ninguna apuesta. Vuelve a "Inicio" y elige tu primer pick.
          </p>
        ) : (
          <div className="space-y-3">
            {bets.map((b) => <BetRowCard key={b.id} bet={b} />)}
          </div>
        )}
      </main>
      <TabBar />
    </div>
  );
}

function BetRowCard({ bet }: { bet: BetRow }) {
  const [when, setWhen] = useState("");
  useEffect(() => {
    setWhen(new Date(bet.placed_at).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }));
  }, [bet.placed_at]);

  const Icon = bet.status === "won" ? CheckCircle2 : bet.status === "lost" ? XCircle : Clock;
  const tone =
    bet.status === "won" ? "text-neon border-neon/40" :
    bet.status === "lost" ? "text-destructive border-destructive/40" :
    "text-muted-foreground border-border";

  return (
    <article className={cn("rounded-2xl border bg-card p-4", tone)} style={{ backgroundImage: "var(--gradient-card)" }}>
      <header className="flex items-center justify-between">
        <span className={cn("flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest", tone)}>
          <Icon className="h-3 w-3" />
          {bet.status === "pending" ? "Pendiente" : bet.status === "won" ? "Ganada" : bet.status === "lost" ? "Perdida" : "Anulada"}
        </span>
        <span suppressHydrationWarning className="font-mono text-[10px] text-muted-foreground">{when}</span>
      </header>

      <div className="mt-2 space-y-1">
        {bet.bet_legs?.map((leg, i) => (
          <div key={i} className="flex items-baseline justify-between text-sm">
            <span className="truncate text-foreground">{leg.label}</span>
            <span className="ml-2 font-mono text-xs text-muted-foreground">@ {Number(leg.odds).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <footer className="mt-3 flex items-end justify-between border-t border-border/50 pt-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Stake</div>
          <div className="font-mono text-sm font-bold">{bet.stake.toLocaleString()} tkn</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {bet.status === "won" ? "Pago" : "Pago potencial"}
          </div>
          <div className="font-mono text-base font-bold text-neon">
            {(bet.status === "won" ? bet.payout : bet.potential_payout).toLocaleString()} tkn
          </div>
        </div>
      </footer>
    </article>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { RequireAuth } from "@/components/RequireAuth";
import { AppHeader } from "@/components/AppHeader";
import { TabBar } from "@/components/TabBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leagues")({
  head: () => ({
    meta: [
      { title: "Clasificación · TokenBet" },
      { name: "description", content: "Ranking en tiempo real por patrimonio neto." },
    ],
  }),
  component: () => <RequireAuth><LeaguePage /></RequireAuth>,
});

interface Row { id: string; username: string; display_name: string | null; bankroll: number; isMe: boolean }

function LeaguePage() {
  const { user } = useSession();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, bankroll")
        .order("bankroll", { ascending: false })
        .limit(50);
      if (cancelled || !data) return;
      setRows(data.map((r) => ({ ...r, isMe: r.id === user.id })));
    };
    load();

    // Realtime: re-rank when any profile bankroll changes
    const channel = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => load())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="min-h-screen pb-24">
      <AppHeader subtitle="Clasificación global" />
      <main className="mx-auto max-w-3xl px-5 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-neon" />
          <h2 className="font-mono text-sm uppercase tracking-widest">Patrimonio neto</h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card" style={{ backgroundImage: "var(--gradient-card)" }}>
          {rows.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Cargando ranking…</div>
          )}
          {rows.map((r, idx) => {
            const rank = idx + 1;
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0 transition-colors",
                  r.isMe && "bg-neon/10",
                )}
              >
                <div className={cn(
                  "grid h-8 w-8 place-items-center rounded-full font-mono text-xs font-bold",
                  rank === 1 ? "bg-neon text-neon-foreground" :
                  rank === 2 ? "bg-accent/80 text-accent-foreground" :
                  rank === 3 ? "bg-muted text-foreground" : "bg-background/60 text-muted-foreground",
                )}>
                  {rank <= 3 ? <Medal className="h-4 w-4" /> : rank}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {r.display_name || r.username}
                    {r.isMe && <span className="ml-2 text-[10px] uppercase tracking-widest text-neon">tú</span>}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">@{r.username}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-bold tabular-nums text-neon">{r.bankroll.toLocaleString()}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">tokens</div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <TabBar />
    </div>
  );
}

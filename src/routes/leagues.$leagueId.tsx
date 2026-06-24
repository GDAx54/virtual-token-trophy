import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Share2, Copy, Check, Medal, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveLeague } from "@/hooks/use-active-league";
import { RequireAuth } from "@/components/RequireAuth";
import { TabBar } from "@/components/TabBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leagues/$leagueId")({
  head: () => ({
    meta: [
      { title: "Clasificación de la liga · TokenBet" },
      { name: "description", content: "Ranking en tiempo real por patrimonio neto." },
    ],
  }),
  component: () => <RequireAuth><LeagueDetailPage /></RequireAuth>,
});

interface LeagueData { id: string; name: string; invite_code: string; starting_bankroll: number }
interface MemberRow { user_id: string; bankroll: number; username: string; display_name: string | null }

function LeagueDetailPage() {
  const { leagueId } = Route.useParams();
  const { user } = useSession();
  const { leagueId: activeId, setLeague } = useActiveLeague();
  const [league, setLeagueData] = useState<LeagueData | null>(null);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const { data: lg } = await supabase
        .from("leagues")
        .select("id, name, invite_code, starting_bankroll")
        .eq("id", leagueId)
        .maybeSingle();
      if (cancelled) return;
      if (!lg) { toast.error("Liga no encontrada"); return; }
      setLeagueData(lg);

      const { data: mems } = await supabase
        .from("league_members")
        .select("user_id, bankroll, profiles!inner(username, display_name)")
        .eq("league_id", leagueId)
        .order("bankroll", { ascending: false });
      if (cancelled || !mems) return;
      setRows(mems.map((m: any) => ({
        user_id: m.user_id,
        bankroll: Number(m.bankroll),
        username: m.profiles.username,
        display_name: m.profiles.display_name,
      })));
    };
    load();

    const channel = supabase
      .channel(`league:${leagueId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "league_members", filter: `league_id=eq.${leagueId}` },
        () => load(),
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user, leagueId]);

  const inviteUrl = league && typeof window !== "undefined"
    ? `${window.location.origin}/join/${league.invite_code}`
    : "";

  const share = async () => {
    if (!inviteUrl || !league) return;
    const text = `Únete a "${league.name}" en TokenBet con el código ${league.invite_code}: ${inviteUrl}`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: league.name, text, url: inviteUrl }); return; } catch {/* */}
    }
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Enlace copiado");
  };

  const isActive = activeId === leagueId;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <Link to="/leagues" className="rounded-full p-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold">{league?.name ?? "…"}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Código: <span className="text-foreground">{league?.invite_code ?? "—"}</span>
            </div>
          </div>
          <button onClick={share} className="flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/10 px-3 py-1.5 text-xs font-bold text-neon">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Invitar"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-6">
        {!isActive && (
          <button
            onClick={() => { setLeague(leagueId); toast.success("Liga activa"); }}
            className="mb-4 w-full rounded-xl border border-neon/40 bg-neon/10 px-3 py-2.5 text-sm font-bold text-neon"
          >
            Hacer activa esta liga
          </button>
        )}

        {league && (
          <div className="mb-4 rounded-xl border border-border bg-card/60 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Enlace de invitación</div>
            <button
              onClick={share}
              className="mt-1 flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-left text-xs"
            >
              <span className="truncate text-muted-foreground">{inviteUrl}</span>
              <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </div>
        )}

        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-neon" />
          <h2 className="text-sm uppercase tracking-widest">Clasificación</h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card" style={{ backgroundImage: "var(--gradient-card)" }}>
          {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Aún no hay miembros.</div>}
          {rows.map((r, idx) => {
            const rank = idx + 1;
            const isMe = r.user_id === user?.id;
            const podium =
              rank === 1
                ? {
                    row: "bg-gradient-to-r from-[#FFD70022] via-[#FFB30011] to-transparent border-l-2 border-l-[#FFD700] animate-pulse-gold",
                    badge: "bg-gradient-to-br from-[#FFE259] to-[#FFA751] text-black shadow-[0_0_18px_rgba(255,200,40,0.65)]",
                    amount: "text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,200,40,0.55)]",
                  }
                : rank === 2
                ? {
                    row: "bg-gradient-to-r from-[#C0C0C022] via-[#A8A8A811] to-transparent border-l-2 border-l-[#C0C0C0] animate-shimmer-silver",
                    badge: "bg-gradient-to-br from-[#E8E8E8] to-[#9A9A9A] text-black shadow-[0_0_10px_rgba(200,200,200,0.45)]",
                    amount: "text-[#D8D8D8]",
                  }
                : rank === 3
                ? {
                    row: "border-l-2 border-l-[#CD7F32]",
                    badge: "bg-gradient-to-br from-[#E8A87C] to-[#8C4A1F] text-black",
                    amount: "text-[#CD7F32]",
                  }
                : {
                    row: "",
                    badge: "bg-background/60 text-muted-foreground",
                    amount: "text-neon",
                  };
            return (
              <div
                key={r.user_id}
                className={cn(
                  "flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0 transition-colors",
                  podium.row,
                  isMe && "ring-1 ring-inset ring-neon/40",
                )}
              >
                <div
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full text-xs font-bold",
                    podium.badge,
                  )}
                >
                  {rank <= 3 ? <Medal className="h-4 w-4" /> : rank}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {r.display_name || r.username}
                    {isMe && <span className="ml-2 text-[10px] uppercase tracking-widest text-neon">tú</span>}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    @{r.username} {rank === 1 && "· 🥇"} {rank === 2 && "· 🥈"} {rank === 3 && "· 🥉"}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-base font-bold tabular-nums", podium.amount)}>
                    {r.bankroll.toLocaleString()} €
                  </div>
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

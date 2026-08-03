import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Share2, Copy, Check, Medal, Trophy, LogOut } from "lucide-react";
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
      { title: "Clasificación de la liga · 90x" },
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
  const navigate = useNavigate();
  const { leagueId: activeId, setLeague } = useActiveLeague();
  const [league, setLeagueData] = useState<LeagueData | null>(null);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const leaveLeague = async () => {
    if (!user || leaving) return;
    setLeaving(true);
    const { error } = await supabase
      .from("league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", user.id);
    setLeaving(false);
    if (error) { toast.error(error.message); return; }
    if (activeId === leagueId) setLeague(null);
    setConfirmLeave(false);
    toast.success("Has salido de la liga");
    navigate({ to: "/leagues" });
  };

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
        .select("user_id, bankroll")
        .eq("league_id", leagueId)
        .order("bankroll", { ascending: false });
      if (cancelled || !mems) return;
      const ids = mems.map((m: any) => m.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, username, display_name").in("id", ids)
        : { data: [] as any[] };
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setRows(mems.map((m: any) => {
        const p = pmap.get(m.user_id);
        return {
          user_id: m.user_id,
          bankroll: Number(m.bankroll),
          username: p?.username ?? "—",
          display_name: p?.display_name ?? null,
        };
      }));
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
    const text = `He creado la liga «${league.name}» en 90x.\n\nÚnete antes de la próxima jornada y demuestra quién sabe más de fútbol.\n\n${inviteUrl} Código: ${league.invite_code}`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: league.name, text, url: inviteUrl });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Invitación copiada. Pégala en tu grupo.");
    } catch {
      /* noop */
    }
  };

  const myRank = user ? rows.findIndex((r) => r.user_id === user.id) + 1 : 0;

  const shareMyRank = async () => {
    if (!inviteUrl || !league || !myRank) return;
    const text =
      myRank === 1
        ? `Voy 1.º en «${league.name}». ¿Alguien me baja del liderato?\n\nÚnete: ${inviteUrl}`
        : myRank <= 3
        ? `Estoy ${myRank}º en «${league.name}». Voy a por el liderato.\n\nÚnete: ${inviteUrl}`
        : `Voy ${myRank}º en «${league.name}», pero esto acaba de empezar.\n\n¿Me retas? ${inviteUrl}`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: league.name, text, url: inviteUrl });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado. Pégalo en tu grupo.");
    } catch {
      /* noop */
    }
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

        {myRank > 0 && (
          <button
            onClick={shareMyRank}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-neon/40"
          >
            <Share2 className="h-4 w-4" /> Compartir mi posición
          </button>
        )}


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

        <button
          onClick={() => setConfirmLeave(true)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm font-bold text-destructive"
        >
          <LogOut className="h-4 w-4" /> Salir de la liga
        </button>
      </main>

      {confirmLeave && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
            <h3 className="text-base font-bold">¿Seguro que quieres salir?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Saldrás de «{league?.name ?? "esta liga"}» y perderás tu saldo en ella. Los demás
              seguirán compitiendo sin ti.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmLeave(false)}
                className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={leaveLeague}
                disabled={leaving}
                className="flex-1 rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-50"
              >
                {leaving ? "Saliendo..." : "Sí, salir"}
              </button>
            </div>
          </div>
        </div>
      )}

      <TabBar />
    </div>
  );
}

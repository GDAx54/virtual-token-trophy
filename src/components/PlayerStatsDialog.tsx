import { useEffect, useState } from "react";
import { Flame, TrendingUp, Trophy, Target, Zap, Skull, Crown, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { achievementById } from "@/lib/achievements";

interface Player { user_id: string; bankroll: number; username: string; display_name: string | null; title?: string | null; featured_badges?: string[] }

interface Stats {
  peak: number;
  netWon: number;
  total: number;
  won: number;
  lost: number;
  pending: number;
  bestStreak: number;
  currentStreak: number;
  biggestHit: number;
  highestOdds: number;
  biggestLoss: number;
  avgStake: number;
}

export function PlayerStatsDialog({
  leagueId, player, rank, totalPlayers, onClose,
}: { leagueId: string; player: Player | null; rank: number; totalPlayers: number; onClose: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!player) return;
    setStats(null);
    let cancelled = false;
    supabase
      .from("bets")
      .select("stake, combined_odds, status, payout, placed_at, resolved_at")
      .eq("league_id", leagueId)
      .eq("user_id", player.user_id)
      .order("placed_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const bets = (data ?? []).map((b: any) => ({ ...b, stake: Number(b.stake), payout: Number(b.payout), odds: Number(b.combined_odds) }));
        const resolved = bets.filter((b) => b.status === "won" || b.status === "lost")
          .sort((a, b) => (a.resolved_at ?? "").localeCompare(b.resolved_at ?? ""));
        let best = 0, run = 0;
        for (const b of resolved) { if (b.status === "won") { run++; best = Math.max(best, run); } else run = 0; }
        let cur = 0;
        for (let i = resolved.length - 1; i >= 0; i--) {
          const s = resolved[i].status;
          if (i === resolved.length - 1) cur = s === "won" ? 1 : -1;
          else if ((s === "won") === cur > 0) cur += cur > 0 ? 1 : -1;
          else break;
        }
        // Reconstrucción aproximada del máximo alcanzado recorriendo los movimientos hacia atrás
        const events: { t: string; d: number }[] = [];
        for (const b of bets) {
          events.push({ t: b.placed_at, d: -b.stake });
          if (b.status === "won" && b.resolved_at) events.push({ t: b.resolved_at, d: b.payout });
        }
        events.sort((a, b) => b.t.localeCompare(a.t));
        let bal = player.bankroll, peak = bal;
        for (const e of events) { bal -= e.d; peak = Math.max(peak, bal); }
        const wonBets = bets.filter((b) => b.status === "won");
        const lostBets = bets.filter((b) => b.status === "lost");
        setStats({
          peak,
          netWon: wonBets.reduce((s, b) => s + (b.payout - b.stake), 0),
          total: bets.length,
          won: wonBets.length,
          lost: lostBets.length,
          pending: bets.filter((b) => b.status === "pending").length,
          bestStreak: best,
          currentStreak: cur,
          biggestHit: wonBets.reduce((m, b) => Math.max(m, b.payout - b.stake), 0),
          highestOdds: wonBets.reduce((m, b) => Math.max(m, b.odds), 0),
          biggestLoss: lostBets.reduce((m, b) => Math.max(m, b.stake), 0),
          avgStake: bets.length ? Math.round(bets.reduce((s, b) => s + b.stake, 0) / bets.length) : 0,
        });
      });
    return () => { cancelled = true; };
  }, [player, leagueId]);

  const eur = (n: number) => `${n.toLocaleString()} €`;
  const resolvedCount = stats ? stats.won + stats.lost : 0;
  const rate = stats && resolvedCount ? Math.round((stats.won / resolvedCount) * 100) : 0;

  const badges: string[] = [];
  if (stats) {
    if (rank === 1) badges.push("👑 Líder de la liga");
    if (rank === totalPlayers && totalPlayers > 1) badges.push("🐢 Farolillo rojo");
    if (stats.currentStreak >= 3) badges.push(`🔥 En racha (${stats.currentStreak})`);
    if (stats.currentStreak <= -3) badges.push(`🧊 Gafado (${-stats.currentStreak})`);
    if (stats.highestOdds >= 5) badges.push("🎯 Francotirador");
    if (stats.avgStake >= 2000) badges.push("🦈 Tiburón");
    if (resolvedCount >= 5 && rate >= 60) badges.push("🧠 Oráculo");
  }

  if (!player) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader className="items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-neon text-lg font-bold text-neon-foreground">
            {(player?.display_name || player?.username || "?").slice(0, 2).toUpperCase()}
          </div>
          <DialogTitle>{player?.display_name || player?.username}</DialogTitle>
          {player?.title && <div className="text-xs font-semibold uppercase tracking-widest text-neon">{player.title}</div>}
          <DialogDescription>@{player?.username} · {rank}º de {totalPlayers}</DialogDescription>
          {!!player?.featured_badges?.length && (
            <div className="flex justify-center gap-2 pt-1">
              {player.featured_badges.map((id) => {
                const a = achievementById(id);
                return a ? (
                  <span key={id} title={a.desc} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold">
                    {a.emoji} {a.name}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </DialogHeader>

        {!stats ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <>
            {badges.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {badges.map((b) => (
                  <span key={b} className="rounded-full border border-neon/30 bg-neon/10 px-2.5 py-0.5 text-[11px] font-semibold text-neon">{b}</span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Tile icon={<Wallet className="h-3.5 w-3.5" />} label="Dinero actual" value={eur(player!.bankroll)} highlight />
              <Tile icon={<Crown className="h-3.5 w-3.5" />} label="Máximo alcanzado" value={eur(stats.peak)} />
              <Tile icon={<TrendingUp className="h-3.5 w-3.5" />} label="Ganado en total" value={eur(stats.netWon)} />
              <Tile icon={<Target className="h-3.5 w-3.5" />} label="% de acierto" value={resolvedCount ? `${rate}%` : "—"} sub={`${stats.won}✓ · ${stats.lost}✗ · ${stats.pending} en juego`} />
              <Tile icon={<Flame className="h-3.5 w-3.5" />} label="Mejor racha" value={`${stats.bestStreak} seguidas`} />
              <Tile icon={<Zap className="h-3.5 w-3.5" />} label="Mayor golpe" value={eur(stats.biggestHit)} />
              <Tile icon={<Trophy className="h-3.5 w-3.5" />} label="Cuota más loca acertada" value={stats.highestOdds ? `x${stats.highestOdds.toFixed(2)}` : "—"} />
              <Tile icon={<Skull className="h-3.5 w-3.5" />} label="Peor batacazo" value={eur(stats.biggestLoss)} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Tile({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}<span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className={`mt-1 text-base font-bold tabular-nums ${highlight ? "text-neon" : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Flame, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { potentialPayout } from "@/lib/betting";

export interface MarketRow {
  id: string;
  category: string;
  label: string;
  selection: string;
  odds: number;
}

export interface MatchRow {
  id: string;
  home_team: { name: string; short: string };
  away_team: { name: string; short: string };
  kickoff_at: string;
  status: "scheduled" | "live" | "finished" | "cancelled";
  score?: { home: number; away: number; minute?: number } | null;
  markets: MarketRow[];
}

interface Props {
  match: MatchRow;
  hot?: boolean;
  onPlaceBet: (params: { marketId: string; odds: number; label: string; stake: number }) => Promise<void> | void;
}

export function MatchCard({ match, hot, onPlaceBet }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ id: string; odds: number; label: string } | null>(null);
  const [stake, setStake] = useState(100);
  const [busy, setBusy] = useState(false);

  // Hydration-safe time: render after mount only
  const [kickoff, setKickoff] = useState("");
  useEffect(() => {
    setKickoff(new Date(match.kickoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [match.kickoff_at]);

  const { mainOdds, extras } = useMemo(() => {
    const main = match.markets.filter((m) => m.category === "1X2");
    const extra = match.markets.filter((m) => m.category !== "1X2");
    return {
      mainOdds: {
        home: main.find((m) => m.selection === "home"),
        draw: main.find((m) => m.selection === "draw"),
        away: main.find((m) => m.selection === "away"),
      },
      extras: extra,
    };
  }, [match.markets]);

  const isLive = match.status === "live";

  const pick = (m: MarketRow | undefined, displayLabel: string) => {
    if (!m) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    setSelected({ id: m.id, odds: Number(m.odds), label: displayLabel });
  };

  const confirm = async () => {
    if (!selected || busy) return;
    setBusy(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([12, 40, 12]);
    try {
      await onPlaceBet({ marketId: selected.id, odds: selected.odds, label: selected.label, stake });
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-neon/40"
      style={{ backgroundImage: "var(--gradient-card)" }}
    >
      <header className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>Mundial · {match.status === "live" ? "EN VIVO" : "Próximo"}</span>
        <span className="flex items-center gap-2">
          {hot && (
            <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-accent">
              <Flame className="h-3 w-3" /> Hot
            </span>
          )}
          {isLive ? (
            <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
              {match.score?.minute ?? 0}'
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> <span suppressHydrationWarning>{kickoff || "--:--"}</span>
            </span>
          )}
        </span>
      </header>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Team team={match.home_team} align="left" />
        <div className="text-center">
          {isLive || match.status === "finished" ? (
            <div className="font-mono text-2xl font-bold">
              {match.score?.home ?? 0}<span className="mx-1 text-muted-foreground">:</span>{match.score?.away ?? 0}
            </div>
          ) : (
            <div className="font-mono text-sm text-muted-foreground">VS</div>
          )}
        </div>
        <Team team={match.away_team} align="right" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Odds label="1" market={mainOdds.home} active={selected?.id === mainOdds.home?.id}
              onClick={() => pick(mainOdds.home, `${match.home_team.short} gana`)} />
        <Odds label="X" market={mainOdds.draw} active={selected?.id === mainOdds.draw?.id}
              onClick={() => pick(mainOdds.draw, "Empate")} />
        <Odds label="2" market={mainOdds.away} active={selected?.id === mainOdds.away?.id}
              onClick={() => pick(mainOdds.away, `${match.away_team.short} gana`)} />
      </div>

      {extras.length > 0 && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-4 flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-neon/40 hover:text-foreground"
          >
            <span>Ver más mercados ({extras.length})</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <div className="mt-3 space-y-3">
              {groupBy(extras, (e) => e.category).map(([cat, items]) => (
                <div key={cat}>
                  <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{cat}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((m) => (
                      <Odds key={m.id} label={m.label} market={m} compact active={selected?.id === m.id}
                            onClick={() => pick(m, `${cat} · ${m.label}`)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="mt-4 rounded-xl border border-neon/30 bg-background/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{selected.label}</span>
            <span className="font-mono font-bold text-neon">@ {selected.odds.toFixed(2)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              value={stake}
              onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 0))}
              className="w-24 rounded-md border border-border bg-background/80 px-2 py-1.5 font-mono text-sm outline-none focus:border-neon"
            />
            <span className="text-xs text-muted-foreground">
              Retorno: <span className="font-mono text-foreground">{potentialPayout(stake, selected.odds).toLocaleString()}</span> €
            </span>
            <button
              onClick={confirm}
              disabled={busy}
              className="ml-auto rounded-md bg-neon px-3 py-1.5 text-xs font-bold text-neon-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {busy ? "..." : "Apostar"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Team({ team, align }: { team: { name: string; short?: string }; align: "left" | "right" }) {
  const abbr = (team.short ?? team.name ?? "?").slice(0, 3).toUpperCase();
  return (
    <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted font-mono text-xs font-bold ring-1 ring-border">
        {abbr}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{team.name}</div>
      </div>
    </div>
  );
}

function Odds({ label, market, active, onClick, compact }: {
  label: string; market?: MarketRow; active?: boolean; onClick: () => void; compact?: boolean;
}) {
  const odds = market ? Number(market.odds) : 0;
  return (
    <button
      onClick={onClick}
      disabled={!market}
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 transition-all disabled:opacity-40",
        compact ? "text-xs" : "flex-col gap-0.5",
        active
          ? "border-neon bg-neon/10 text-neon shadow-[var(--shadow-glow)]"
          : "border-border bg-background/40 hover:border-neon/40 hover:bg-background/70",
      )}
    >
      <span className={cn("font-mono text-muted-foreground", !compact && "text-xs uppercase")}>{label}</span>
      <span className={cn("font-mono font-bold tabular-nums", compact ? "text-foreground" : "text-base")}>
        {odds ? odds.toFixed(2) : "—"}
      </span>
    </button>
  );
}

function groupBy<T>(arr: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    const v = m.get(k) ?? [];
    v.push(item);
    m.set(k, v);
  }
  return Array.from(m.entries());
}

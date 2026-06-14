import { useState } from "react";
import { ChevronDown, Flame, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { potentialPayout } from "@/lib/betting";

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

export interface ExtraMarket {
  id: string;
  label: string;          // "Córners +9.5"
  category: string;       // "Córners" | "Tarjetas" | "Tiros a puerta"
  odds: number;
}

export interface Match {
  id: string;
  league: string;         // "Mundial · Grupo A"
  kickoff: string;        // ISO
  status: "scheduled" | "live" | "finished";
  minute?: number;
  homeTeam: { name: string; short: string; crest?: string; score?: number };
  awayTeam: { name: string; short: string; crest?: string; score?: number };
  odds: MatchOdds;
  extraMarkets?: ExtraMarket[];
  hot?: boolean;          // trending bet
}

interface Props {
  match: Match;
  defaultStake?: number;
  onPlaceBet?: (params: { matchId: string; selection: string; odds: number; stake: number }) => void;
}

type Selection = "home" | "draw" | "away" | string;

export function MatchCard({ match, defaultStake = 100, onPlaceBet }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ key: Selection; odds: number; label: string } | null>(null);
  const [stake, setStake] = useState(defaultStake);

  const isLive = match.status === "live";
  const kickoff = new Date(match.kickoff).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const pick = (key: Selection, odds: number, label: string) => {
    setSelected({ key, odds, label });
    // haptic feedback (web): mobile browsers honor this
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
  };

  const confirm = () => {
    if (!selected) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([12, 40, 12]);
    onPlaceBet?.({ matchId: match.id, selection: selected.key, odds: selected.odds, stake });
    setSelected(null);
  };

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-neon/40"
      style={{ backgroundImage: "var(--gradient-card)" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span className="font-mono">{match.league}</span>
        <span className="flex items-center gap-2">
          {match.hot && (
            <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-accent">
              <Flame className="h-3 w-3" /> Hot
            </span>
          )}
          {isLive ? (
            <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 font-mono text-destructive">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
              {match.minute ?? 0}'
            </span>
          ) : (
            <span className="flex items-center gap-1 font-mono">
              <Clock className="h-3 w-3" /> {kickoff}
            </span>
          )}
        </span>
      </header>

      {/* Teams */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamBlock team={match.homeTeam} align="left" />
        <div className="text-center">
          {isLive || match.status === "finished" ? (
            <div className="font-mono text-2xl font-bold text-foreground">
              {match.homeTeam.score ?? 0}<span className="mx-1 text-muted-foreground">:</span>{match.awayTeam.score ?? 0}
            </div>
          ) : (
            <div className="font-mono text-sm text-muted-foreground">VS</div>
          )}
        </div>
        <TeamBlock team={match.awayTeam} align="right" />
      </div>

      {/* Odds (1X2) */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <OddsButton label="1" odds={match.odds.home} active={selected?.key === "home"} onClick={() => pick("home", match.odds.home, `${match.homeTeam.short} gana`)} />
        <OddsButton label="X" odds={match.odds.draw} active={selected?.key === "draw"} onClick={() => pick("draw", match.odds.draw, "Empate")} />
        <OddsButton label="2" odds={match.odds.away} active={selected?.key === "away"} onClick={() => pick("away", match.odds.away, `${match.awayTeam.short} gana`)} />
      </div>

      {/* Extra markets toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-neon/40 hover:text-foreground"
      >
        <span>Ver más mercados {match.extraMarkets?.length ? `(${match.extraMarkets.length})` : ""}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && match.extraMarkets && match.extraMarkets.length > 0 && (
        <div className="mt-3 space-y-3">
          {groupByCategory(match.extraMarkets).map(([cat, items]) => (
            <div key={cat}>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{cat}</div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((m) => (
                  <OddsButton
                    key={m.id}
                    label={m.label}
                    odds={m.odds}
                    active={selected?.key === m.id}
                    onClick={() => pick(m.id, m.odds, m.label)}
                    compact
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bet slip preview */}
      {selected && (
        <div className="mt-4 rounded-xl border border-neon/30 bg-background/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{selected.label}</span>
            <span className="font-mono font-bold text-neon">@ {selected.odds.toFixed(2)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={stake}
              onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 0))}
              className="w-24 rounded-md border border-border bg-background/80 px-2 py-1.5 font-mono text-sm text-foreground outline-none focus:border-neon"
            />
            <span className="text-xs text-muted-foreground">
              Retorno: <span className="font-mono text-foreground">{potentialPayout(stake, selected.odds).toLocaleString()}</span> tokens
            </span>
            <button
              onClick={confirm}
              className="ml-auto rounded-md bg-neon px-3 py-1.5 text-xs font-bold text-neon-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-105 active:scale-95"
            >
              Apostar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function TeamBlock({ team, align }: { team: Match["homeTeam"]; align: "left" | "right" }) {
  return (
    <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted font-mono text-xs font-bold text-foreground ring-1 ring-border">
        {team.short.slice(0, 3).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">{team.name}</div>
      </div>
    </div>
  );
}

function OddsButton({
  label, odds, active, onClick, compact,
}: { label: string; odds: number; active?: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group/btn flex items-center justify-between rounded-lg border px-3 py-2 transition-all",
        compact ? "text-xs" : "flex-col gap-0.5",
        active
          ? "border-neon bg-neon/10 text-neon shadow-[var(--shadow-glow)]"
          : "border-border bg-background/40 hover:border-neon/40 hover:bg-background/70",
      )}
    >
      <span className={cn("font-mono", compact ? "text-muted-foreground" : "text-xs uppercase text-muted-foreground")}>{label}</span>
      <span className={cn("font-mono font-bold tabular-nums", compact ? "text-foreground" : "text-base text-foreground group-hover/btn:text-neon")}>
        {odds.toFixed(2)}
      </span>
    </button>
  );
}

function groupByCategory(markets: ExtraMarket[]): [string, ExtraMarket[]][] {
  const map = new Map<string, ExtraMarket[]>();
  for (const m of markets) {
    const arr = map.get(m.category) ?? [];
    arr.push(m);
    map.set(m.category, arr);
  }
  return Array.from(map.entries());
}

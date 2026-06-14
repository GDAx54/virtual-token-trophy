import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Coins, Users, TrendingUp } from "lucide-react";
import { MatchCard, type Match } from "@/components/MatchCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TokenBet — Apuestas sociales con dinero ficticio" },
      { name: "description", content: "Compite con tus amigos en ligas privadas durante el torneo. 100% tokens virtuales, 0% dinero real." },
      { property: "og:title", content: "TokenBet — Bet with your friends, not your wallet" },
      { property: "og:description", content: "Bankroll virtual, ligas privadas y mercados profundos. Solo diversión." },
    ],
  }),
  component: HomePage,
});

const MOCK_MATCHES: Match[] = [
  {
    id: "m1",
    league: "Mundial · Grupo A",
    kickoff: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
    status: "scheduled",
    homeTeam: { name: "Argentina", short: "ARG" },
    awayTeam: { name: "Francia", short: "FRA" },
    odds: { home: 2.10, draw: 3.40, away: 3.20 },
    hot: true,
    extraMarkets: [
      { id: "c1", label: "Más de 9.5", category: "Córners", odds: 1.85 },
      { id: "c2", label: "Menos de 9.5", category: "Córners", odds: 1.95 },
      { id: "t1", label: "Más de 3.5", category: "Tarjetas", odds: 2.10 },
      { id: "t2", label: "1ª amarilla: ARG", category: "Tarjetas", odds: 2.05 },
      { id: "s1", label: "Messi marca", category: "Goleadores", odds: 2.50 },
      { id: "s2", label: "Mbappé marca", category: "Goleadores", odds: 2.30 },
    ],
  },
  {
    id: "m2",
    league: "Mundial · Grupo B",
    kickoff: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    status: "live",
    minute: 67,
    homeTeam: { name: "Brasil", short: "BRA", score: 2 },
    awayTeam: { name: "España", short: "ESP", score: 1 },
    odds: { home: 1.45, draw: 4.80, away: 6.50 },
    extraMarkets: [
      { id: "p1", label: "Posesión BRA >55%", category: "Estadísticas", odds: 1.75 },
      { id: "sh1", label: "Tiros a puerta +9", category: "Estadísticas", odds: 2.20 },
    ],
  },
  {
    id: "m3",
    league: "Mundial · Grupo C",
    kickoff: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
    status: "scheduled",
    homeTeam: { name: "Inglaterra", short: "ENG" },
    awayTeam: { name: "Portugal", short: "POR" },
    odds: { home: 2.40, draw: 3.10, away: 2.90 },
  },
];

function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div>
            <h1 className="font-mono text-lg font-bold tracking-tight">
              token<span className="text-neon">bet</span>
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Mundial 2026 · Liga: Los Cracks</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-3 py-1.5">
            <Coins className="h-4 w-4 text-neon" />
            <span className="font-mono text-sm font-bold text-neon">12,450</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">tkn</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-28 pt-6">
        {/* Stats strip */}
        <section className="mb-6 grid grid-cols-3 gap-3">
          <StatPill icon={<Trophy className="h-4 w-4" />} label="Ranking" value="#2" trend="+1" />
          <StatPill icon={<TrendingUp className="h-4 w-4" />} label="ROI" value="+24.5%" trend="hot" />
          <StatPill icon={<Users className="h-4 w-4" />} label="Liga" value="8/10" />
        </section>

        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Partidos de hoy
        </h2>
        <div className="space-y-4">
          {MOCK_MATCHES.map((m) => (
            <MatchCard key={m.id} match={m} onPlaceBet={(p) => console.log("bet", p)} />
          ))}
        </div>
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          <TabItem label="Inicio" active />
          <TabItem label="Ligas" />
          <TabItem label="Apuestas" />
          <TabItem label="Perfil" />
        </div>
      </nav>
    </div>
  );
}

function StatPill({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: string; trend?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-widest">{label}</span></div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-lg font-bold text-foreground">{value}</span>
        {trend && <span className="font-mono text-[10px] text-neon">{trend}</span>}
      </div>
    </div>
  );
}

function TabItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <button className={`py-3 text-center font-mono text-xs uppercase tracking-widest transition-colors ${active ? "text-neon" : "text-muted-foreground hover:text-foreground"}`}>
      {label}
      {active && <div className="mx-auto mt-1 h-0.5 w-6 rounded-full bg-neon shadow-[var(--shadow-glow)]" />}
    </button>
  );
}

export interface BetLite { stake: number; payout: number; odds: number; status: string; resolved_at: string | null }
export interface ChallengeLite { kind: string; status: string }

export interface AchievementStats {
  total: number; won: number; lost: number; bestStreak: number;
  highestOdds: number; biggestHit: number; avgStake: number;
  challengesWon: number; exactWon: number;
}

export interface Achievement { id: string; emoji: string; name: string; desc: string; test: (s: AchievementStats) => boolean }

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_win", emoji: "🎉", name: "Primera victoria", desc: "Acierta tu primera jugada", test: (s) => s.won >= 1 },
  { id: "streak3", emoji: "🔥", name: "En racha", desc: "3 aciertos seguidos", test: (s) => s.bestStreak >= 3 },
  { id: "streak5", emoji: "⚡", name: "Imparable", desc: "5 aciertos seguidos", test: (s) => s.bestStreak >= 5 },
  { id: "sniper", emoji: "🎯", name: "Francotirador", desc: "Acierta una cuota de x5 o más", test: (s) => s.highestOdds >= 5 },
  { id: "big_hit", emoji: "💥", name: "Golpe maestro", desc: "Gana +1.000 € en una sola jugada", test: (s) => s.biggestHit >= 1000 },
  { id: "shark", emoji: "🦈", name: "Tiburón", desc: "Media de 2.000 € por jugada (mín. 3)", test: (s) => s.total >= 3 && s.avgStake >= 2000 },
  { id: "oracle", emoji: "🧠", name: "Oráculo", desc: "60% de acierto con 5+ resueltas", test: (s) => s.won + s.lost >= 5 && s.won / (s.won + s.lost) >= 0.6 },
  { id: "veteran", emoji: "🎖️", name: "Veterano", desc: "25 jugadas realizadas", test: (s) => s.total >= 25 },
  { id: "challenger", emoji: "🧩", name: "Retador", desc: "Gana un reto de partido", test: (s) => s.challengesWon >= 1 },
  { id: "seer", emoji: "🔮", name: "Adivino", desc: "Acierta un marcador exacto", test: (s) => s.exactWon >= 1 },
];

export const DEFAULT_TITLE = "Novato";

export function computeStats(bets: BetLite[], challenges: ChallengeLite[] = []): AchievementStats {
  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");
  const resolved = [...won, ...lost].sort((a, b) => (a.resolved_at ?? "").localeCompare(b.resolved_at ?? ""));
  let best = 0, run = 0;
  for (const b of resolved) { if (b.status === "won") { run++; best = Math.max(best, run); } else run = 0; }
  return {
    total: bets.length, won: won.length, lost: lost.length, bestStreak: best,
    highestOdds: won.reduce((m, b) => Math.max(m, b.odds), 0),
    biggestHit: won.reduce((m, b) => Math.max(m, b.payout - b.stake), 0),
    avgStake: bets.length ? bets.reduce((s, b) => s + b.stake, 0) / bets.length : 0,
    challengesWon: challenges.filter((c) => c.status === "won").length,
    exactWon: challenges.filter((c) => c.status === "won" && c.kind === "exact_score").length,
  };
}

export function unlockedIds(s: AchievementStats): Set<string> {
  return new Set(ACHIEVEMENTS.filter((a) => a.test(s)).map((a) => a.id));
}

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

// Espejo de las reglas de duelos semanales para mostrar en pantalla y para tests.
// La decisión real (resultado y rango) la toma solo la base de datos.

export const RANKS = [
  { name: "Novato", emoji: "🌱" },
  { name: "Promesa", emoji: "⭐" },
  { name: "Profesional", emoji: "🛡️" },
  { name: "Élite", emoji: "💎" },
  { name: "Leyenda", emoji: "👑" },
] as const;

export const RANK_HELP =
  "Cada semana (lunes a domingo) te enfrentas a un rival de tu liga. Gana quien saque más rentabilidad con sus apuestas de esa semana. Ganar sube un rango, perder baja uno, empatar o descansar no cambia nada. Novato es el mínimo y Leyenda el máximo.";

export type BetLite = { status: "won" | "lost" | "void" | "pending"; stake: number; payout: number };
export type Perf = { net: number; valid: number; pending: number };

export function perf(bets: BetLite[]): Perf {
  let net = 0, valid = 0, pending = 0;
  for (const b of bets) {
    if (b.status === "won") { net += b.payout - b.stake; valid++; }
    else if (b.status === "lost") { net -= b.stake; valid++; }
    else if (b.status === "pending") pending++;
  }
  return { net, valid, pending };
}

export function returnPct(net: number, ref: number): number | null {
  return ref > 0 ? (net * 100) / ref : null;
}

export type Outcome =
  | { kind: "pending" }
  | { kind: "void" }
  | { kind: "draw" }
  | { kind: "win" | "walkover"; winner: "a" | "b" };

export function decide(a: { ref: number; p: Perf }, b: { ref: number; p: Perf }): Outcome {
  if (a.p.pending + b.p.pending > 0) return { kind: "pending" };
  const okA = a.ref > 0 && a.p.valid > 0;
  const okB = b.ref > 0 && b.p.valid > 0;
  if (!okA && !okB) return { kind: "void" };
  if (okA !== okB) return { kind: "walkover", winner: okA ? "a" : "b" };
  const ra = a.p.net / a.ref, rb = b.p.net / b.ref; // misma comparación sin redondear
  if (a.p.net * b.ref === b.p.net * a.ref || ra === rb) return { kind: "draw" };
  return { kind: "win", winner: ra > rb ? "a" : "b" };
}

export function nextRank(rank: number, delta: -1 | 0 | 1): number {
  return Math.min(4, Math.max(0, rank + delta));
}

/** Emparejamiento: orden por rango/saldo, descansa quien menos descansos lleva, evita repetir rival. */
export function pairUp(
  players: { id: string; rank: number; ref: number; byes: number }[],
  prevOpponent: Record<string, string | undefined> = {},
): { pairs: [string, string][]; bye: string | null } {
  const list = players.filter((p) => p.ref > 0)
    .sort((x, y) => y.rank - x.rank || y.ref - x.ref || x.id.localeCompare(y.id));
  const used = new Set<string>();
  let bye: string | null = null;
  if (list.length % 2 === 1) {
    let best = list.length - 1;
    list.forEach((p, i) => { if (p.byes < list[best].byes || (p.byes === list[best].byes && i > best)) best = i; });
    bye = list[best].id; used.add(bye);
  }
  const pairs: [string, string][] = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i]; if (used.has(p.id)) continue; used.add(p.id);
    const rest = list.slice(i + 1).filter((q) => !used.has(q.id));
    const q = rest.find((r) => r.id !== prevOpponent[p.id]) ?? rest[0];
    if (!q) continue; used.add(q.id); pairs.push([p.id, q.id]);
  }
  return { pairs, bye };
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  const s = v.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return v > 0 ? `+${s}%` : `${s}%`;
}

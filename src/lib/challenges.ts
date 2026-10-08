// Retos: reglas de juego. Espejo de public.challenge_config() en la base de datos,
// que es la única autoridad para validar, cerrar y pagar. Esto solo sirve para mostrar importes.
export const CHALLENGE_RULES = {
  version: 1,
  exact_score: 0.006,
  total_goals_edge: 0.004, // 0 goles o 5+
  total_goals_mid: 0.0025, // 1 a 4 goles
  btts: 0.0015,
  diff_small: 0.0025, // empate o por 1
  diff_two: 0.0035,
  diff_three: 0.0045,
  script: 0.004,
  wildcard_multiplier: 2,
  weekly_cap: 0.03,
  max_goals: 20,
} as const;

export type ChallengeKind = "exact_score" | "total_goals" | "btts" | "goal_diff" | "script";

export type ChallengeSelection =
  | { home: number; away: number }
  | { goals: number }
  | { yes: boolean }
  | { diff: number }
  | { result: "home" | "draw" | "away"; goals: "low" | "high" };

export const CHALLENGE_LABELS: Record<ChallengeKind, string> = {
  exact_score: "Marcador exacto",
  total_goals: "Goles totales",
  btts: "Marcan los dos",
  goal_diff: "Diferencia de goles",
  script: "Guion del partido",
};

export function challengePct(kind: ChallengeKind, sel: any): number {
  const r = CHALLENGE_RULES;
  switch (kind) {
    case "exact_score": return r.exact_score;
    case "total_goals": return sel.goals === 0 || sel.goals >= 5 ? r.total_goals_edge : r.total_goals_mid;
    case "btts": return r.btts;
    case "goal_diff": {
      const d = Math.abs(sel.diff);
      return d <= 1 ? r.diff_small : d === 2 ? r.diff_two : r.diff_three;
    }
    case "script": return r.script;
  }
}

export function challengeHit(kind: ChallengeKind, sel: any, h: number, a: number): boolean {
  const t = h + a, d = h - a;
  switch (kind) {
    case "exact_score": return sel.home === h && sel.away === a;
    case "total_goals": return sel.goals >= 5 ? t >= 5 : t === sel.goals;
    case "btts": return sel.yes === (h > 0 && a > 0);
    case "goal_diff": return sel.diff >= 3 ? d >= 3 : sel.diff <= -3 ? d <= -3 : d === sel.diff;
    case "script": {
      const res = h > a ? "home" : h < a ? "away" : "draw";
      return sel.result === res && (sel.goals === "high") === (t >= 3);
    }
  }
}

export function theoreticalPrize(b0: number, pct: number, wildcard: boolean): number {
  return Math.round(b0 * pct * (wildcard ? CHALLENGE_RULES.wildcard_multiplier : 1));
}

export function weeklyCap(b0: number): number {
  return Math.round(b0 * CHALLENGE_RULES.weekly_cap);
}

/** Importe abonado tras aplicar el límite semanal. */
export function cappedAward(theoretical: number, cap: number, alreadyAwarded: number): number {
  return Math.min(theoretical, Math.max(0, cap - alreadyAwarded));
}

export function describeSelection(kind: ChallengeKind, sel: any, home: string, away: string): string {
  switch (kind) {
    case "exact_score": return `${home} ${sel.home}-${sel.away} ${away}`;
    case "total_goals": return sel.goals >= 5 ? "5 o más goles" : `${sel.goals} goles`;
    case "btts": return sel.yes ? "Marcan los dos: Sí" : "Marcan los dos: No";
    case "goal_diff":
      if (sel.diff === 0) return "Empate";
      return `${sel.diff > 0 ? home : away} gana por ${Math.abs(sel.diff)}${Math.abs(sel.diff) >= 3 ? " o más" : ""}`;
    case "script": {
      const r = sel.result === "home" ? `Gana ${home}` : sel.result === "away" ? `Gana ${away}` : "Empate";
      return `${r} y ${sel.goals === "high" ? "3 o más goles" : "0–2 goles"}`;
    }
  }
}

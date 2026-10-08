import { describe, it, expect } from "vitest";
import { challengeHit, challengePct, theoreticalPrize, weeklyCap, cappedAward } from "./challenges";
import { potentialPayout, resolveBet } from "./betting";

describe("retos", () => {
  it("0-0", () => {
    expect(challengeHit("exact_score", { home: 0, away: 0 }, 0, 0)).toBe(true);
    expect(challengeHit("total_goals", { goals: 0 }, 0, 0)).toBe(true);
    expect(challengeHit("btts", { yes: false }, 0, 0)).toBe(true);
    expect(challengeHit("goal_diff", { diff: 0 }, 0, 0)).toBe(true);
    expect(challengeHit("script", { result: "draw", goals: "low" }, 0, 0)).toBe(true);
  });
  it("4-3", () => {
    expect(challengeHit("exact_score", { home: 4, away: 3 }, 4, 3)).toBe(true);
    expect(challengeHit("exact_score", { home: 3, away: 3 }, 4, 3)).toBe(false);
    expect(challengeHit("total_goals", { goals: 5 }, 4, 3)).toBe(true);
    expect(challengeHit("total_goals", { goals: 4 }, 4, 3)).toBe(false);
    expect(challengeHit("btts", { yes: true }, 4, 3)).toBe(true);
    expect(challengeHit("script", { result: "home", goals: "high" }, 4, 3)).toBe(true);
    expect(challengeHit("script", { result: "home", goals: "low" }, 4, 3)).toBe(false);
  });
  it("diferencia positiva, negativa y 3+", () => {
    expect(challengeHit("goal_diff", { diff: 2 }, 3, 1)).toBe(true);
    expect(challengeHit("goal_diff", { diff: -1 }, 0, 1)).toBe(true);
    expect(challengeHit("goal_diff", { diff: -3 }, 0, 5)).toBe(true);
    expect(challengeHit("goal_diff", { diff: 1 }, 0, 1)).toBe(false);
  });
  it("premios con B0 = 1000", () => {
    expect(theoreticalPrize(1000, challengePct("exact_score", {}), false)).toBe(6);
    expect(theoreticalPrize(1000, challengePct("exact_score", {}), true)).toBe(12);
    expect(theoreticalPrize(1000, challengePct("script", {}), false)).toBe(4);
    expect(theoreticalPrize(10000, challengePct("btts", {}), false)).toBe(15);
    expect(challengePct("total_goals", { goals: 0 })).toBe(0.004);
    expect(challengePct("total_goals", { goals: 3 })).toBe(0.0025);
    expect(challengePct("goal_diff", { diff: -2 })).toBe(0.0035);
  });
  it("límite semanal", () => {
    expect(weeklyCap(10000)).toBe(300);
    expect(cappedAward(120, 300, 250)).toBe(50); // recorte parcial
    expect(cappedAward(120, 300, 300)).toBe(0); // agotado
    expect(cappedAward(60, 300, 0)).toBe(60);
  });
  it("regresión: las apuestas pagan igual", () => {
    expect(potentialPayout(100, 2.5)).toBe(250);
    expect(resolveBet({ id: "b", userId: "u", stake: 100, status: "pending", legs: [{ marketId: "m", selection: "home", odds: 2.1, result: "won" }] }).payout).toBe(210);
  });
});

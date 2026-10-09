import { describe, it, expect } from "vitest";
import { computeStats, unlockedIds } from "./achievements";

const b = (status: string, t: string, odds = 2, stake = 100, payout = 200) => ({ status, resolved_at: t, odds, stake, payout });

describe("logros", () => {
  it("racha de 3 desbloquea En racha pero no Imparable", () => {
    const ids = unlockedIds(computeStats([b("won", "1"), b("won", "2"), b("won", "3"), b("lost", "4")]));
    expect(ids.has("streak3")).toBe(true);
    expect(ids.has("streak5")).toBe(false);
  });
  it("cuota x5 acertada desbloquea Francotirador", () => {
    expect(unlockedIds(computeStats([b("won", "1", 5)])).has("sniper")).toBe(true);
    expect(unlockedIds(computeStats([b("won", "1", 4.9)])).has("sniper")).toBe(false);
  });
  it("marcador exacto ganado desbloquea Adivino", () => {
    expect(unlockedIds(computeStats([], [{ kind: "exact_score", status: "won" }])).has("seer")).toBe(true);
  });
});

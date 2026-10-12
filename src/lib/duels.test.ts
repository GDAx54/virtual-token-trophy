import { describe, it, expect } from "vitest";
import { decide, nextRank, pairUp, perf, returnPct } from "./duels";

const P = (net: number, valid = 1, pending = 0) => ({ net, valid, pending });

describe("duelos semanales", () => {
  it("gana la mayor rentabilidad positiva (Pablo +10% vs Juan +5%)", () => {
    expect(decide({ ref: 1000, p: P(100) }, { ref: 5000, p: P(250) })).toEqual({ kind: "win", winner: "a" });
  });
  it("gana quien pierde menos (-4% vs -9%)", () => {
    expect(decide({ ref: 1000, p: P(-40) }, { ref: 1000, p: P(-90) })).toEqual({ kind: "win", winner: "a" });
  });
  it("empate con igual rentabilidad", () => {
    expect(decide({ ref: 1000, p: P(50) }, { ref: 2000, p: P(100) })).toEqual({ kind: "draw" });
  });
  it("sube y baja un rango", () => {
    expect(nextRank(2, 1)).toBe(3);
    expect(nextRank(2, -1)).toBe(1);
    expect(nextRank(2, 0)).toBe(2);
  });
  it("límites Novato y Leyenda", () => {
    expect(nextRank(0, -1)).toBe(0);
    expect(nextRank(4, 1)).toBe(4);
    expect(nextRank(4, -1)).toBe(3);
  });
  it("saldo de referencia cero no divide entre cero y no participa", () => {
    expect(returnPct(100, 0)).toBeNull();
    expect(decide({ ref: 0, p: P(0) }, { ref: 1000, p: P(10) })).toEqual({ kind: "walkover", winner: "b" });
  });
  it("apuestas anuladas no cuentan como ganancia ni como participación", () => {
    expect(perf([{ status: "void", stake: 100, payout: 100 }])).toEqual({ net: 0, valid: 0, pending: 0 });
  });
  it("incomparecencias: uno gana, ninguno anula", () => {
    expect(decide({ ref: 1000, p: P(-500) }, { ref: 1000, p: P(0, 0) })).toEqual({ kind: "walkover", winner: "a" });
    expect(decide({ ref: 1000, p: P(0, 0) }, { ref: 1000, p: P(0, 0) })).toEqual({ kind: "void" });
  });
  it("número impar: descansa quien menos descansos lleva", () => {
    const r = pairUp([
      { id: "a", rank: 2, ref: 100, byes: 1 }, { id: "b", rank: 1, ref: 100, byes: 0 }, { id: "c", rank: 0, ref: 100, byes: 1 },
    ]);
    expect(r.bye).toBe("b");
    expect(r.pairs).toEqual([["a", "c"]]);
  });
  it("evita repetir rival si hay alternativa", () => {
    const r = pairUp([
      { id: "a", rank: 3, ref: 1, byes: 0 }, { id: "b", rank: 2, ref: 1, byes: 0 },
      { id: "c", rank: 1, ref: 1, byes: 0 }, { id: "d", rank: 0, ref: 1, byes: 0 },
    ], { a: "b", b: "a" });
    expect(r.pairs).toEqual([["a", "c"], ["b", "d"]]);
  });
  it("partido aplazado (apuesta pendiente) deja el duelo pendiente", () => {
    expect(decide({ ref: 1000, p: P(100, 1, 1) }, { ref: 1000, p: P(0) })).toEqual({ kind: "pending" });
  });
});

// Pure betting math — used by client preview and server resolvers.

export type BetStatus = "pending" | "won" | "lost" | "void" | "cashout";

export interface BetLeg {
  marketId: string;       // e.g. "match_winner", "corners_over_9_5"
  selection: string;      // e.g. "home", "over"
  odds: number;           // decimal odds, > 1.00
  result?: "won" | "lost" | "void";
}

export interface Bet {
  id: string;
  userId: string;
  stake: number;          // euros wagered
  legs: BetLeg[];         // 1 leg = single, >1 = parlay/combo
  status: BetStatus;
}

/** Combined decimal odds for a parlay; void legs collapse to 1.0. */
export function combinedOdds(legs: BetLeg[]): number {
  return legs.reduce((acc, leg) => {
    if (leg.result === "void") return acc * 1;
    return acc * leg.odds;
  }, 1);
}

/**
 * Potential payout (stake + profit) for a given stake and decimal odds.
 * Example: 100 € @ 2.50 → 250 payout (150 profit).
 */
export function potentialPayout(stake: number, odds: number): number {
  if (stake <= 0 || odds <= 1) return 0;
  return round2(stake * odds);
}

export function potentialProfit(stake: number, odds: number): number {
  return round2(potentialPayout(stake, odds) - stake);
}

/**
 * Resolve a bet given each leg's result. Returns the net euro delta
 * to credit/debit the user balance (positive = win, negative = loss).
 * Assumes the stake was already deducted at bet placement.
 */
export function resolveBet(bet: Bet): { status: BetStatus; payout: number; delta: number } {
  if (bet.legs.some((l) => !l.result)) {
    return { status: "pending", payout: 0, delta: 0 };
  }
  if (bet.legs.some((l) => l.result === "lost")) {
    return { status: "lost", payout: 0, delta: 0 };
  }
  // All legs won (or void). Void-only parlay → refund stake.
  const odds = combinedOdds(bet.legs);
  if (odds === 1) {
    return { status: "void", payout: bet.stake, delta: bet.stake };
  }
  const payout = potentialPayout(bet.stake, odds);
  return { status: "won", payout, delta: payout };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

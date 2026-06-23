// Cron: trae partidos reales del Mundial desde el marcador público de ESPN
// y los sincroniza con la DB. Cubre partidos recientes, en directo y próximos.
import { createFileRoute } from "@tanstack/react-router";

const TOURNAMENT_ID = "fifa-wc-2026";
const ESPN_LEAGUE = "fifa.world";

type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

interface EspnScoreboard {
  events?: EspnEvent[];
}

interface EspnEvent {
  id: string;
  name: string;
  date: string;
  competitions?: EspnCompetition[];
}

interface EspnCompetition {
  competitors?: EspnCompetitor[];
  status?: {
    displayClock?: string;
    type?: {
      name?: string;
      state?: string;
      completed?: boolean;
    };
  };
  odds?: Array<EspnOdds | null>;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
  };
}

interface EspnOdds {
  moneyline?: {
    home?: OddsPoint;
    draw?: OddsPoint;
    away?: OddsPoint;
  };
}

interface OddsPoint {
  current?: { odds?: string | number };
  close?: { odds?: string | number };
  open?: { odds?: string | number };
}

export const Route = createFileRoute("/api/public/cron/sync-matches")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

function ymdDash(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function mapStatus(s: string | null, postponed: string | null): "scheduled" | "live" | "finished" | "cancelled" {
  if (postponed === "yes") return "cancelled";
  const v = (s ?? "").toUpperCase();
  if (["FT", "AET", "PEN"].includes(v)) return "finished";
  if (["1H", "HT", "2H", "ET", "P", "LIVE"].includes(v)) return "live";
  if (["CANC", "ABD", "PST"].includes(v)) return "cancelled";
  return "scheduled";
}

async function handler({ request }: { request: Request }) {
  const apikey = request.headers.get("apikey");
  const expectedKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (expectedKey && apikey !== expectedKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const syncStartedAt = new Date().toISOString();

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 2);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 14);

  const dates = `${ymdCompact(start)}-${ymdCompact(end)}`;
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${ESPN_LEAGUE}/scoreboard?dates=${dates}&limit=200`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "TokenBet/1.0" } });

  if (!res.ok) {
    return Response.json({ ok: false, error: `ESPN respondió ${res.status}` }, { status: 502 });
  }

  const data = (await res.json()) as EspnScoreboard;
  const events = data.events ?? [];

  let upserted = 0;
  let marketsSynced = 0;
  let matchesSettled = 0;

  for (const event of events) {
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find((team) => team.homeAway === "home");
    const away = competition?.competitors?.find((team) => team.homeAway === "away");
    if (!competition || !home?.team?.displayName || !away?.team?.displayName) continue;

    const status = mapStatus(competition);
    const homeScore = Number(home.score);
    const awayScore = Number(away.score);
    const score =
      (status === "live" || status === "finished") && Number.isFinite(homeScore) && Number.isFinite(awayScore)
        ? { home: homeScore, away: awayScore, minute: parseMinute(competition.status?.displayClock) }
        : null;

    const matchId = `espn:${event.id}`;
    const homeTeam = toTeam(home);
    const awayTeam = toTeam(away);

    const { error } = await supabaseAdmin.rpc("upsert_match", {
      _id: matchId,
      _tournament: TOURNAMENT_ID,
      _home: homeTeam,
      _away: awayTeam,
      _kickoff: new Date(event.date).toISOString(),
      _status: status,
      _score: score,
    });

    if (error) {
      console.error("[sync-matches] upsert error", event.id, error.message);
      continue;
    }

    upserted++;

    if (status === "scheduled" || status === "live") {
      marketsSynced += await sync1x2Markets(supabaseAdmin, matchId, homeTeam.name, awayTeam.name, competition.odds);
    }

    if (status === "finished") {
      const { error: settleError } = await supabaseAdmin.rpc("settle_match", { _match_id: matchId });
      if (settleError) console.error("[sync-matches] settle error", event.id, settleError.message);
      else matchesSettled++;
    }
  }

  const staleClosed = await closeStaleMatches(supabaseAdmin, syncStartedAt, start.toISOString(), end.toISOString());

  return Response.json({
    ok: true,
    source: "ESPN",
    scanned: events.length,
    upserted,
    marketsSynced,
    matchesSettled,
    staleClosed,
    tournament: TOURNAMENT_ID,
  });
}

function ymdCompact(d: Date) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function mapStatus(competition: EspnCompetition): MatchStatus {
  const type = competition.status?.type;
  const name = (type?.name ?? "").toUpperCase();
  if (name.includes("CANCEL") || name.includes("POSTPON") || name.includes("SUSPEND")) return "cancelled";
  if (type?.completed || type?.state === "post") return "finished";
  if (type?.state === "in") return "live";
  return "scheduled";
}

function parseMinute(displayClock?: string) {
  const minute = Number((displayClock ?? "").match(/\d+/)?.[0]);
  return Number.isFinite(minute) ? minute : undefined;
}

function toTeam(competitor: EspnCompetitor) {
  const team = competitor.team!;
  const name = team.displayName ?? team.shortDisplayName ?? "Equipo";
  return {
    id: team.id ?? name,
    name,
    short: (team.abbreviation ?? team.shortDisplayName ?? name.slice(0, 3)).toUpperCase(),
    logo: team.logo ?? null,
  };
}

function americanToDecimal(value: string | number | undefined, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(String(value).replace("+", ""));
  if (!Number.isFinite(n) || n === 0) return fallback;
  const decimal = n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  return Math.max(1.01, Number(decimal.toFixed(2)));
}

function pointValue(point: OddsPoint | undefined, fallback: number) {
  return americanToDecimal(point?.current?.odds ?? point?.close?.odds ?? point?.open?.odds, fallback);
}

async function sync1x2Markets(
  supabaseAdmin: any,
  matchId: string,
  homeName: string,
  awayName: string,
  odds?: Array<EspnOdds | null>,
) {
  const moneyline = odds?.find(Boolean)?.moneyline;
  const desired = [
    { category: "1X2", selection: "home", label: `${homeName} gana`, odds: pointValue(moneyline?.home, 2.1) },
    { category: "1X2", selection: "draw", label: "Empate", odds: pointValue(moneyline?.draw, 3.3) },
    { category: "1X2", selection: "away", label: `${awayName} gana`, odds: pointValue(moneyline?.away, 2.8) },
  ];

  const { data: existing, error } = await supabaseAdmin
    .from("markets")
    .select("id, category, selection")
    .eq("match_id", matchId)
    .eq("category", "1X2");

  if (error) {
    console.error("[sync-matches] market read error", matchId, error.message);
    return 0;
  }

  let synced = 0;
  for (const market of desired) {
    const found = existing?.find((m: { category: string; selection: string }) => m.category === market.category && m.selection === market.selection);
    const payload = { ...market, odds: market.odds, is_open: true, result: null, resolved_at: null };
    const result = found
      ? await supabaseAdmin.from("markets").update(payload).eq("id", found.id)
      : await supabaseAdmin.from("markets").insert({ match_id: matchId, ...payload });

    if (result.error) console.error("[sync-matches] market write error", matchId, market.selection, result.error.message);
    else synced++;
  }

  return synced;
}

async function closeStaleMatches(supabaseAdmin: any, syncStartedAt: string, startIso: string, endIso: string) {
  const { data: fakeRows } = await supabaseAdmin
    .from("matches")
    .select("id")
    .eq("tournament_id", TOURNAMENT_ID)
    .in("status", ["scheduled", "live"])
    .not("id", "like", "espn:%");

  const { data: staleEspnRows } = await supabaseAdmin
    .from("matches")
    .select("id")
    .eq("tournament_id", TOURNAMENT_ID)
    .in("status", ["scheduled", "live"])
    .like("id", "espn:%")
    .gte("kickoff_at", startIso)
    .lte("kickoff_at", endIso)
    .lt("updated_at", syncStartedAt);

  const staleIds = [...(fakeRows ?? []), ...(staleEspnRows ?? [])].map((row: { id: string }) => row.id);
  if (staleIds.length === 0) return 0;

  await supabaseAdmin.from("markets").update({ is_open: false }).in("match_id", staleIds);
  await supabaseAdmin.from("matches").update({ status: "cancelled", updated_at: new Date().toISOString() }).in("id", staleIds);
  return staleIds.length;
}

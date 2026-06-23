// Cron: trae partidos del FIFA World Cup 2026 desde TheSportsDB (API libre, sin key)
// y los upsertea en la DB. Cubre el rango ±2 días para recoger en-vivo y finalizados.
import { createFileRoute } from "@tanstack/react-router";

const TOURNAMENT_ID = "fifa-wc-2026";
const WC_LEAGUE_ID = "4429"; // FIFA World Cup en TheSportsDB
const SEASON = "2026";

interface TsdbEvent {
  idEvent: string;
  strLeague: string;
  idLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strTimestamp: string | null;
  dateEvent: string;
  strTime: string | null;
  strStatus: string | null;
  strPostponed: string | null;
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

async function handler() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Trae toda la temporada (una sola llamada barata)
  const seasonUrl = `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=${WC_LEAGUE_ID}&s=${SEASON}`;
  const seasonRes = await fetch(seasonUrl);
  const seasonJson = seasonRes.ok ? ((await seasonRes.json()) as { events?: TsdbEvent[] }) : { events: [] };
  const seasonEvents = seasonJson.events ?? [];

  // 2) Refresca los próximos 3 días vía /eventsday para coger en-vivo y resultados frescos
  const days: string[] = [];
  for (let i = -1; i <= 2; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    days.push(ymdDash(d));
  }
  const dayEvents: TsdbEvent[] = [];
  for (const date of days) {
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${date}&s=Soccer`);
    if (!r.ok) continue;
    const j = (await r.json()) as { events?: TsdbEvent[] };
    for (const e of j.events ?? []) {
      if (e.idLeague === WC_LEAGUE_ID) dayEvents.push(e);
    }
  }

  // Dedup por idEvent: prioriza dayEvents (datos más frescos)
  const byId = new Map<string, TsdbEvent>();
  for (const e of seasonEvents) byId.set(e.idEvent, e);
  for (const e of dayEvents) byId.set(e.idEvent, e);

  let upserted = 0;
  for (const e of byId.values()) {
    const status = mapStatus(e.strStatus, e.strPostponed);
    const home = Number(e.intHomeScore);
    const away = Number(e.intAwayScore);
    const score =
      (status === "live" || status === "finished") && !isNaN(home) && !isNaN(away)
        ? { home, away }
        : null;
    const kickoff = e.strTimestamp
      ? new Date(e.strTimestamp + "Z").toISOString()
      : new Date(`${e.dateEvent}T${e.strTime ?? "00:00:00"}Z`).toISOString();

    const { error } = await supabaseAdmin.rpc("upsert_match", {
      _id: `tsdb:${e.idEvent}`,
      _tournament: TOURNAMENT_ID,
      _home: { id: e.strHomeTeam, name: e.strHomeTeam, short: e.strHomeTeam.slice(0, 3).toUpperCase() },
      _away: { id: e.strAwayTeam, name: e.strAwayTeam, short: e.strAwayTeam.slice(0, 3).toUpperCase() },
      _kickoff: kickoff,
      _status: status,
      _score: score,
    });
    if (error) console.error("[sync-matches] upsert error", e.idEvent, error.message);
    else upserted++;
  }

  return Response.json({ ok: true, scanned: byId.size, upserted, tournament: TOURNAMENT_ID });
}

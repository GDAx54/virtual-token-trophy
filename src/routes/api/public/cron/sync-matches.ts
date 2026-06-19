// Cron: trae partidos del Mundial (FIFA World Cup 2026) y los upsertea en la DB.
// Fuente: free-api-live-football-data (RapidAPI). Sin cuotas reales → markets simulados.
import { createFileRoute } from "@tanstack/react-router";

const TOURNAMENT_ID = "fifa-wc-2026";
const WC_LEAGUE_ID = 894793; // FIFA World Cup en FotMob/free-api-live-football-data
const RAPID_HOST = "free-api-live-football-data.p.rapidapi.com";

function ymd(d: Date) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

interface ApiMatch {
  id: number;
  leagueId: number;
  home: { id: number; name: string; longName: string; score: number };
  away: { id: number; name: string; longName: string; score: number };
  status: { utcTime: string; started: boolean; finished: boolean; cancelled: boolean; scoreStr?: string };
}

export const Route = createFileRoute("/api/public/cron/sync-matches")({
  server: {
    handlers: {
      POST: handler,
      GET: handler, // permite test manual desde el browser
    },
  },
});

async function handler() {
  const key = process.env.RAPIDAPI_FOOTBALL_KEY;
  if (!key) return Response.json({ error: "missing RAPIDAPI_FOOTBALL_KEY" }, { status: 500 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Próximos 10 días + hoy + ayer (para recoger partidos finalizados)
  const days: string[] = [];
  for (let i = -1; i <= 10; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    days.push(ymd(d));
  }

  let upserted = 0;
  let scanned = 0;

  for (const date of days) {
    const res = await fetch(`https://${RAPID_HOST}/football-get-matches-by-date?date=${date}`, {
      headers: { "x-rapidapi-host": RAPID_HOST, "x-rapidapi-key": key },
    });
    if (!res.ok) continue;
    const json = (await res.json()) as { response?: { matches?: ApiMatch[] } };
    const matches = json.response?.matches ?? [];
    scanned += matches.length;

    const wc = matches.filter((m) => m.leagueId === WC_LEAGUE_ID);
    for (const m of wc) {
      const status = m.status.cancelled
        ? "cancelled"
        : m.status.finished
          ? "finished"
          : m.status.started
            ? "live"
            : "scheduled";
      const score =
        status === "live" || status === "finished"
          ? { home: m.home.score, away: m.away.score }
          : null;

      const { error } = await supabaseAdmin.rpc("upsert_match", {
        _id: `fotmob:${m.id}`,
        _tournament: TOURNAMENT_ID,
        _home: { id: m.home.id, name: m.home.name, longName: m.home.longName },
        _away: { id: m.away.id, name: m.away.name, longName: m.away.longName },
        _kickoff: m.status.utcTime,
        _status: status,
        _score: score,
      });
      if (!error) upserted++;
      else console.error("[sync-matches] upsert error", error.message);
    }
  }

  return Response.json({ ok: true, scanned, upserted, tournament: TOURNAMENT_ID });
}

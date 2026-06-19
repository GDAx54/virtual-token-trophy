// Cron: liquida partidos finalizados → resuelve mercados, suma/resta tokens.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/resolve-bets")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

async function handler() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Partidos finished con mercados aún abiertos
  const { data: pending, error } = await supabaseAdmin
    .from("matches")
    .select("id, markets!inner(id, is_open)")
    .eq("status", "finished")
    .eq("markets.is_open", true);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const matchIds = Array.from(new Set((pending ?? []).map((m) => m.id)));
  let totalBetsResolved = 0;

  for (const matchId of matchIds) {
    const { data, error: rpcErr } = await supabaseAdmin.rpc("settle_match", { _match_id: matchId });
    if (rpcErr) {
      console.error("[resolve-bets] settle_match failed", matchId, rpcErr.message);
      continue;
    }
    totalBetsResolved += (data as number) ?? 0;
  }

  return Response.json({ ok: true, matchesSettled: matchIds.length, betsResolved: totalBetsResolved });
}

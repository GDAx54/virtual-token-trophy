import { useEffect, useMemo, useState } from "react";
import { Swords, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RankBadge } from "@/components/RankBadge";
import { RANKS, fmtPct } from "@/lib/duels";
import { cn } from "@/lib/utils";

type Duel = {
  id: string; period_key: string; period_start: string; period_end: string;
  player_a: string; player_b: string | null; status: string; outcome: string | null; winner: string | null;
  ret_a: number | null; ret_b: number | null; rank_before_a: number | null; rank_after_a: number | null;
  rank_before_b: number | null; rank_after_b: number | null; taunt: string | null;
};
type Member = { user_id: string; username: string; display_name: string | null };
type RankRow = { user_id: string; rank: number; wins: number; losses: number; draws: number; win_streak: number };
const EMOJIS = ["🔥", "💀", "🤡", "👏", "😂"];

const weekLabel = (d: Duel) => {
  const s = new Date(d.period_start), e = new Date(new Date(d.period_end).getTime() - 1);
  const f = (x: Date) => x.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
  return `Semana ${f(s)} – ${f(e)}`;
};

export function DuelSection({ leagueId, leagueName, me, members }: { leagueId: string; leagueName: string; me: string; members: Member[] }) {
  const [duels, setDuels] = useState<Duel[]>([]);
  const [ranks, setRanks] = useState<Map<string, RankRow>>(new Map());
  const [live, setLive] = useState<{ ret_a: number | null; ret_b: number | null; valid_a: number; valid_b: number } | null>(null);
  const [reactions, setReactions] = useState<{ duel_id: string; user_id: string; emoji: string }[]>([]);
  const [taunt, setTaunt] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: d }, { data: r }] = await Promise.all([
        supabase.from("weekly_duels").select("*").eq("league_id", leagueId).order("period_start", { ascending: false }).limit(200),
        supabase.from("league_ranks").select("user_id, rank, wins, losses, draws, win_streak").eq("league_id", leagueId),
      ]);
      const list = (d ?? []) as Duel[];
      setDuels(list);
      setRanks(new Map(((r ?? []) as RankRow[]).map((x) => [x.user_id, x])));
      const ids = list.filter((x) => x.status === "finished").slice(0, 50).map((x) => x.id);
      if (ids.length) {
        const { data: re } = await supabase.from("duel_reactions").select("duel_id, user_id, emoji").in("duel_id", ids);
        setReactions(re ?? []);
      }
    })();
  }, [leagueId, tick]);

  const mine = useMemo(() => duels.filter((d) => d.player_a === me || d.player_b === me), [duels, me]);
  const current = mine[0];

  useEffect(() => {
    setLive(null);
    if (!current || !current.player_b || current.status === "finished" || current.status === "void") return;
    supabase.rpc("duel_live", { _duel: current.id }).then(({ data }) => data && setLive(data as any));
  }, [current?.id, current?.status]);

  const name = (id: string | null) => {
    const m = members.find((x) => x.user_id === id);
    return m ? m.display_name || m.username : "Exmiembro";
  };
  const rankOf = (id: string | null) => (id && ranks.get(id)?.rank) || 0;

  if (!current) {
    return (
      <section className="mb-4 rounded-2xl border border-border bg-card/60 p-4 text-sm">
        <div className="mb-1 flex items-center gap-2 font-bold"><Swords className="h-4 w-4 text-neon" /> Duelo semanal</div>
        <p className="text-muted-foreground">Los duelos se emparejan cada lunes. Entrarás en el próximo, con tu rango actual: <RankBadge rank={rankOf(me)} leagueName={leagueName} /></p>
      </section>
    );
  }

  const iAmA = current.player_a === me;
  const rival = iAmA ? current.player_b : current.player_a;
  const now = Date.now();
  const started = now >= new Date(current.period_start).getTime();
  const ended = now >= new Date(current.period_end).getTime();
  const state =
    current.status === "bye" ? "Descansas" :
    current.status === "finished" ? "Finalizado" :
    current.status === "void" ? "Anulado" :
    current.status === "pending" || ended ? "Pendiente de liquidación" :
    started ? "En curso" : "Próximo";
  const myRet = current.status === "finished" ? (iAmA ? current.ret_a : current.ret_b) : live ? (iAmA ? live.ret_a : live.ret_b) : null;
  const rivRet = current.status === "finished" ? (iAmA ? current.ret_b : current.ret_a) : live ? (iAmA ? live.ret_b : live.ret_a) : null;

  // Historial real contra este rival
  const h2h = rival ? mine.filter((d) => d.status === "finished" && (d.player_a === rival || d.player_b === rival) && d.id !== current.id) : [];
  const myW = h2h.filter((d) => d.winner === me).length, rivW = h2h.filter((d) => d.winner === rival).length;
  const msgs: string[] = [];
  if (h2h[0]?.winner === rival && current.status !== "finished") msgs.push("La última vez te ganó. Esta semana tienes la revancha.");
  if (h2h.length) msgs.push(`Vais ${myW}–${rivW} en vuestros enfrentamientos.`);
  const ms = ranks.get(me)?.win_streak ?? 0, rs = rival ? ranks.get(rival)?.win_streak ?? 0 : 0;
  if (ms >= 2 && rs >= 2 && ms === rs) msgs.push(`Ambos lleváis ${ms} victorias consecutivas.`);

  let verdict = "";
  if (current.status === "finished") {
    verdict = current.winner === me ? "Has ganado el duelo" : current.winner ? `Ganó ${name(current.winner)}` : "Empate";
    if (current.outcome === "walkover") verdict += " (por incomparecencia)";
  } else if (current.status === "void") verdict = "Ninguno apostó: duelo anulado, sin cambios de rango.";
  else if (myRet != null && rivRet != null && started)
    verdict = (myRet > rivRet ? "Vas por delante." : myRet < rivRet ? "Vas por detrás." : "Vais empatados.") + " Resultado provisional.";
  else if (started) verdict = "Necesitáis al menos una apuesta resuelta esta semana. Resultado provisional.";

  const myBefore = iAmA ? current.rank_before_a : current.rank_before_b;
  const myAfter = iAmA ? current.rank_after_a : current.rank_after_b;
  const duelReacts = reactions.filter((r) => r.duel_id === current.id);

  const react = async (e: string) => {
    const { error } = await supabase.rpc("react_duel", { _duel: current.id, _emoji: e });
    if (error) toast.error(error.message); else setTick((t) => t + 1);
  };
  const saveTaunt = async () => {
    const { error } = await supabase.rpc("set_duel_taunt", { _duel: current.id, _text: taunt });
    if (error) toast.error(error.message); else { toast.success("Frase guardada"); setTaunt(""); setTick((t) => t + 1); }
  };

  const Side = ({ id, ret, label }: { id: string | null; ret: number | null; label: string }) => (
    <div className="min-w-0 flex-1 text-center">
      <div className="mx-auto mb-1 grid h-10 w-10 place-items-center rounded-full bg-neon text-sm font-bold text-neon-foreground">
        {name(id).slice(0, 2).toUpperCase()}
      </div>
      <div className="truncate text-sm font-semibold">{label}</div>
      <RankBadge rank={rankOf(id)} leagueName={leagueName} className="mt-1" />
      <div className={cn("mt-1 text-lg font-bold tabular-nums", ret == null ? "text-muted-foreground" : ret >= 0 ? "text-neon" : "text-destructive")}>{fmtPct(ret)}</div>
    </div>
  );

  const past = mine.filter((d) => d.id !== current.id);

  return (
    <section className="mb-4 rounded-2xl border border-neon/30 bg-card p-4" style={{ backgroundImage: "var(--gradient-card)" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold"><Swords className="h-4 w-4 text-neon" /> {current.status === "bye" ? "Esta semana descansas" : `Tu rival esta semana: ${name(rival)}`}</div>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{state}</span>
      </div>
      <div className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">{weekLabel(current)}</div>

      {current.status === "bye" ? (
        <p className="text-sm text-muted-foreground">Te toca descansar. Tu rango no cambia: <RankBadge rank={rankOf(me)} leagueName={leagueName} /></p>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <Side id={me} ret={myRet} label="Tú" />
            <div className="pt-3 text-xs font-bold text-muted-foreground">VS</div>
            <Side id={rival} ret={rivRet} label={name(rival)} />
          </div>
          {verdict && <p className="mt-3 text-center text-sm font-semibold">{verdict}</p>}
          {myBefore != null && myAfter != null && (
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Tu rango: {RANKS[myBefore].emoji} {RANKS[myBefore].name} → {RANKS[myAfter].emoji} {RANKS[myAfter].name}
            </p>
          )}
          {msgs.map((m) => <p key={m} className="mt-1 text-center text-xs text-neon">{m}</p>)}

          {current.status === "finished" && (
            <div className="mt-3 border-t border-border/50 pt-3">
              {current.taunt && <p className="mb-2 text-center text-sm italic">«{current.taunt}» — {name(current.winner)}</p>}
              {current.winner === me && (
                <div className="mb-2 flex gap-2">
                  <input value={taunt} maxLength={100} onChange={(e) => setTaunt(e.target.value)} placeholder="Deja tu frase (máx. 100)"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm" />
                  <button onClick={saveTaunt} className="rounded-lg bg-neon px-3 text-sm font-bold text-neon-foreground">Guardar</button>
                </div>
              )}
              <div className="flex justify-center gap-1.5">
                {EMOJIS.map((e) => {
                  const n = duelReacts.filter((r) => r.emoji === e).length;
                  const mineR = duelReacts.some((r) => r.emoji === e && r.user_id === me);
                  return (
                    <button key={e} onClick={() => react(e)} className={cn("rounded-full border px-2 py-0.5 text-sm", mineR ? "border-neon bg-neon/10" : "border-border")}>
                      {e}{n ? <span className="ml-1 text-xs">{n}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {past.length > 0 && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <button onClick={() => setShowHistory((s) => !s)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Historial ({ranks.get(me)?.wins ?? 0}V · {ranks.get(me)?.losses ?? 0}D · {ranks.get(me)?.draws ?? 0}E · racha {ranks.get(me)?.win_streak ?? 0})
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5 text-xs">
              {past.map((d) => {
                const a = d.player_a === me, r = a ? d.player_b : d.player_a;
                const res = d.status === "bye" ? "Descanso" : d.status === "void" ? "Anulado" : d.status !== "finished" ? "Pendiente" : d.winner === me ? "Victoria" : d.winner ? "Derrota" : "Empate";
                const rb = a ? d.rank_before_a : d.rank_before_b, ra = a ? d.rank_after_a : d.rank_after_b;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-background/50 px-2.5 py-1.5">
                    <span className="min-w-0 truncate">{d.period_key} · {r ? `vs ${name(r)}` : "—"}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {d.status === "finished" && `${fmtPct(a ? d.ret_a : d.ret_b)} / ${fmtPct(a ? d.ret_b : d.ret_a)} · `}
                      <b className="text-foreground">{res}</b>
                      {rb != null && ra != null && rb !== ra && ` · ${RANKS[rb].emoji}→${RANKS[ra].emoji}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CHALLENGE_LABELS, CHALLENGE_RULES, challengePct, theoreticalPrize, weeklyCap,
  type ChallengeKind,
} from "@/lib/challenges";

export interface ChallengeRow {
  id: string;
  match_id: string;
  kind: ChallengeKind;
  selection: any;
  wildcard: boolean;
  status: "pending" | "won" | "lost" | "void";
  theoretical_prize: number | null;
  awarded_prize: number;
  cap_note: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  leagueId: string;
  b0: number;
  match: { id: string; kickoff_at: string; home_team: { name: string }; away_team: { name: string } };
  existing?: ChallengeRow;
  onSaved: () => void;
}

const KINDS: ChallengeKind[] = ["exact_score", "total_goals", "btts", "goal_diff", "script"];

function defaultSel(kind: ChallengeKind): any {
  switch (kind) {
    case "exact_score": return { home: 1, away: 0 };
    case "total_goals": return { goals: 2 };
    case "btts": return { yes: true };
    case "goal_diff": return { diff: 0 };
    case "script": return { result: "home", goals: "low" };
  }
}

export function ChallengeDialog({ open, onClose, leagueId, b0, match, existing, onSaved }: Props) {
  const [kind, setKind] = useState<ChallengeKind>(existing?.kind ?? "btts");
  const [sel, setSel] = useState<any>(existing?.selection ?? defaultSel("btts"));
  const [wildcard, setWildcard] = useState(existing?.wildcard ?? false);
  const [busy, setBusy] = useState(false);
  const [closeAt, setCloseAt] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind(existing?.kind ?? "btts");
    setSel(existing?.selection ?? defaultSel("btts"));
    setWildcard(existing?.wildcard ?? false);
    setCloseAt(new Date(match.kickoff_at).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
  }, [open, existing, match.kickoff_at]);

  const home = match.home_team.name, away = match.away_team.name;
  const prize = theoreticalPrize(b0, challengePct(kind, sel), wildcard);
  const cap = weeklyCap(b0);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("submit_challenge", {
      _league_id: leagueId, _match_id: match.id, _kind: kind, _selection: sel, _wildcard: wildcard,
    });
    setBusy(false);
    if (error) return toast.error("No se pudo guardar el reto", { description: error.message });
    toast.success("Reto guardado");
    onSaved();
    onClose();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("remove_challenge", { _league_id: leagueId, _match_id: match.id });
    setBusy(false);
    if (error) return toast.error("No se pudo quitar", { description: error.message });
    onSaved();
    onClose();
  };

  const chip = (active: boolean) => cn(
    "rounded-lg border px-3 py-2 text-xs transition-all",
    active ? "border-neon bg-neon/10 text-neon" : "border-border bg-background/40 hover:border-neon/40",
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reto · {home} vs {away}</DialogTitle>
          <DialogDescription>
            Gratis: no descuenta saldo y fallar no resta. Un reto por partido; puedes cambiarlo hasta el cierre ({closeAt}).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k} className={chip(kind === k)} onClick={() => { setKind(k); setSel(defaultSel(k)); }}>
              {CHALLENGE_LABELS[k]}
            </button>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-background/40 p-3">
          {kind === "exact_score" && (
            <div className="grid grid-cols-2 gap-3">
              {(["home", "away"] as const).map((side) => (
                <label key={side} className="text-xs text-muted-foreground">
                  <span className="mb-1 block truncate">{side === "home" ? home : away}</span>
                  <input
                    type="number" min={0} max={CHALLENGE_RULES.max_goals} value={sel[side]}
                    onChange={(e) => setSel({ ...sel, [side]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    className="w-full rounded-md border border-border bg-background/80 px-2 py-1.5 text-base text-foreground outline-none focus:border-neon"
                  />
                </label>
              ))}
              {(sel.home > CHALLENGE_RULES.max_goals || sel.away > CHALLENGE_RULES.max_goals) && (
                <p className="col-span-2 text-xs text-destructive">Máximo {CHALLENGE_RULES.max_goals} goles por equipo.</p>
              )}
            </div>
          )}
          {kind === "total_goals" && (
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((g) => (
                <button key={g} className={chip(sel.goals === g)} onClick={() => setSel({ goals: g })}>{g === 5 ? "5+" : g}</button>
              ))}
            </div>
          )}
          {kind === "btts" && (
            <div className="grid grid-cols-2 gap-2">
              <button className={chip(sel.yes === true)} onClick={() => setSel({ yes: true })}>Sí</button>
              <button className={chip(sel.yes === false)} onClick={() => setSel({ yes: false })}>No</button>
            </div>
          )}
          {kind === "goal_diff" && (
            <div className="grid grid-cols-1 gap-2">
              {[3, 2, 1, 0, -1, -2, -3].map((d) => (
                <button key={d} className={chip(sel.diff === d)} onClick={() => setSel({ diff: d })}>
                  {d === 0 ? "Empate" : `${d > 0 ? home : away} gana por ${Math.abs(d)}${Math.abs(d) === 3 ? " o más" : ""}`}
                </button>
              ))}
            </div>
          )}
          {kind === "script" && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {([["home", home], ["draw", "Empate"], ["away", away]] as const).map(([v, l]) => (
                  <button key={v} className={cn(chip(sel.result === v), "truncate")} onClick={() => setSel({ ...sel, result: v })}>{l}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className={chip(sel.goals === "low")} onClick={() => setSel({ ...sel, goals: "low" })}>0–2 goles</button>
                <button className={chip(sel.goals === "high")} onClick={() => setSel({ ...sel, goals: "high" })}>3 o más</button>
              </div>
            </>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={wildcard} onChange={(e) => setWildcard(e.target.checked)} className="accent-[var(--color-neon)]" />
          Usar mi comodín de la semana (×{CHALLENGE_RULES.wildcard_multiplier})
        </label>

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Premio si aciertas: <span className="font-bold text-neon">hasta {prize.toLocaleString()} €</span>
          <br />Los retos permiten ganar hasta {cap.toLocaleString()} € extra por semana. Si llegas al límite, el premio se recorta.
        </div>

        <div className="flex gap-2">
          {existing && existing.status === "pending" && (
            <button onClick={remove} disabled={busy} className="rounded-md border border-border px-3 py-2 text-xs">Quitar</button>
          )}
          <button onClick={save} disabled={busy}
            className="ml-auto rounded-md bg-neon px-4 py-2 text-xs font-bold text-neon-foreground shadow-[var(--shadow-glow)] disabled:opacity-50">
            {busy ? "..." : existing ? "Actualizar reto" : "Guardar reto"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ACHIEVEMENTS, DEFAULT_TITLE, computeStats, unlockedIds } from "@/lib/achievements";
import { cn } from "@/lib/utils";

export function AchievementsShowcase({ userId }: { userId: string }) {
  const [unlocked, setUnlocked] = useState<Set<string> | null>(null);
  const [featured, setFeatured] = useState<string[]>([]);
  const [title, setTitle] = useState<string>(DEFAULT_TITLE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: bets }, { data: ch }, { data: prof }] = await Promise.all([
        supabase.from("bets").select("stake, payout, combined_odds, status, resolved_at").eq("user_id", userId),
        supabase.from("match_challenges").select("kind, status").eq("user_id", userId),
        supabase.from("profiles").select("title, featured_badges").eq("id", userId).single(),
      ]);
      const stats = computeStats(
        (bets ?? []).map((b: any) => ({ stake: Number(b.stake), payout: Number(b.payout), odds: Number(b.combined_odds), status: b.status, resolved_at: b.resolved_at })),
        (ch ?? []) as any,
      );
      const ids = unlockedIds(stats);
      setUnlocked(ids);
      setFeatured(((prof?.featured_badges as string[]) ?? []).filter((x) => ids.has(x)));
      setTitle(prof?.title || DEFAULT_TITLE);
    })();
  }, [userId]);

  const toggle = (id: string) => {
    if (!unlocked?.has(id)) return;
    setFeatured((f) => f.includes(id) ? f.filter((x) => x !== id) : f.length >= 3 ? (toast.error("Máximo 3 insignias destacadas"), f) : [...f, id]);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ featured_badges: featured, title: title === DEFAULT_TITLE ? null : title }).eq("id", userId);
    setSaving(false);
    error ? toast.error("No se pudo guardar") : toast.success("Perfil actualizado", { description: "Tus amigos ya lo ven en la liga" });
  };

  const titles = [DEFAULT_TITLE, ...ACHIEVEMENTS.filter((a) => unlocked?.has(a.id)).map((a) => a.name)];

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-neon" />
        <h2 className="text-sm font-bold uppercase tracking-widest">Mis logros</h2>
        <span className="ml-auto text-xs text-muted-foreground">{unlocked?.size ?? 0}/{ACHIEVEMENTS.length}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Elige hasta 3 insignias y un título. Se mostrarán junto a tu nombre en la clasificación.</p>

      {!unlocked ? <div className="py-6 text-center text-sm text-muted-foreground">Cargando…</div> : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((a) => {
              const on = unlocked.has(a.id); const sel = featured.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggle(a.id)} disabled={!on}
                  className={cn("rounded-xl border p-3 text-left transition-colors",
                    sel ? "border-neon bg-neon/10" : "border-border bg-background/50",
                    !on && "opacity-40 grayscale")}>
                  <div className="text-xl">{on ? a.emoji : "🔒"}</div>
                  <div className="mt-1 text-xs font-semibold">{a.name}</div>
                  <div className="text-[10px] text-muted-foreground">{a.desc}</div>
                </button>
              );
            })}
          </div>

          <label className="mt-4 block text-[10px] uppercase tracking-widest text-muted-foreground">Título</label>
          <select value={title} onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {titles.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <button onClick={save} disabled={saving}
            className="mt-4 w-full rounded-xl bg-neon py-2.5 text-sm font-bold text-neon-foreground disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar mi perfil"}
          </button>
        </>
      )}
    </section>
  );
}

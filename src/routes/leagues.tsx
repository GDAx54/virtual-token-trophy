import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trophy, Users, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveLeague } from "@/hooks/use-active-league";
import { RequireAuth } from "@/components/RequireAuth";
import { AppHeader } from "@/components/AppHeader";
import { TabBar } from "@/components/TabBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leagues")({
  head: () => ({
    meta: [
      { title: "Mis ligas · TokenBet" },
      { name: "description", content: "Crea ligas privadas, invita a tus amigos y compite por el mayor patrimonio." },
    ],
  }),
  component: () => <RequireAuth><LeaguesPage /></RequireAuth>,
});

interface LeagueRow { id: string; name: string; invite_code: string; bankroll: number; members: number }

function LeaguesPage() {
  const { user } = useSession();
  const { leagueId, setLeague } = useActiveLeague();
  const navigate = useNavigate();
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: mems } = await supabase
      .from("league_members")
      .select("bankroll, leagues!inner(id, name, invite_code)")
      .eq("user_id", user.id);

    const list: LeagueRow[] = (mems ?? []).map((m: any) => ({
      id: m.leagues.id,
      name: m.leagues.name,
      invite_code: m.leagues.invite_code,
      bankroll: Number(m.bankroll),
      members: 0,
    }));

    // Count members per league
    if (list.length) {
      const ids = list.map((l) => l.id);
      const { data: counts } = await supabase
        .from("league_members")
        .select("league_id")
        .in("league_id", ids);
      const tally = new Map<string, number>();
      (counts ?? []).forEach((c) => tally.set(c.league_id, (tally.get(c.league_id) ?? 0) + 1));
      list.forEach((l) => { l.members = tally.get(l.id) ?? 1; });
    }

    setRows(list.sort((a, b) => b.bankroll - a.bankroll));
    setLoading(false);

    // Auto-activate first league if none selected
    if (list.length && !leagueId) setLeague(list[0].id);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  return (
    <div className="min-h-screen pb-24">
      <AppHeader subtitle="Mis ligas" />
      <main className="mx-auto max-w-3xl px-5 pt-6">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neon/40 bg-neon/10 px-3 py-2.5 text-sm font-bold text-neon transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" /> Crear liga
          </button>
          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-sm font-medium text-foreground hover:border-neon/40"
          >
            <Users className="h-4 w-4" /> Unirse con código
          </button>
        </div>

        {showCreate && <CreateLeagueForm onDone={(id) => { setShowCreate(false); setLeague(id); load(); }} />}
        {showJoin && <JoinLeagueForm onDone={(id) => { setShowJoin(false); setLeague(id); load(); navigate({ to: "/leagues/$leagueId", params: { leagueId: id } }); }} />}

        <h2 className="mt-6 mb-3 text-xs uppercase tracking-widest text-muted-foreground">
          Tus ligas
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-card/40" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            Aún no estás en ninguna liga. Crea una o únete con el código de un amigo.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((l) => {
              const active = l.id === leagueId;
              return (
                <Link
                  key={l.id}
                  to="/leagues/$leagueId"
                  params={{ leagueId: l.id }}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors",
                    active ? "border-neon/60" : "border-border hover:border-neon/30",
                  )}
                  style={{ backgroundImage: "var(--gradient-card)" }}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLeague(l.id); }}
                    title={active ? "Liga activa" : "Activar liga"}
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                      active ? "bg-neon text-neon-foreground" : "bg-muted text-muted-foreground hover:bg-neon/30",
                    )}
                  >
                    {active ? <Check className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-base font-semibold">{l.name}</div>
                      {active && <span className="rounded-full bg-neon/15 px-2 py-0.5 text-[9px] uppercase tracking-widest text-neon">activa</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <span>{l.members} {l.members === 1 ? "miembro" : "miembros"}</span>
                      <span>·</span>
                      <span>código {l.invite_code}</span>
                      <span>·</span>
                      <span className="text-neon">Ver ranking →</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-neon">{l.bankroll.toLocaleString()} €</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <TabBar />
    </div>
  );
}

function CreateLeagueForm({ onDone }: { onDone: (id: string) => void }) {
  const { user } = useSession();
  const [name, setName] = useState("");
  const [stake, setStake] = useState(10000);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !name.trim() || busy) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("leagues")
      .insert({ name: name.trim(), owner_id: user.id, starting_bankroll: stake })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) { toast.error(error?.message ?? "Error"); return; }
    toast.success("Liga creada");
    onDone(data.id);
  };

  return (
    <div className="rounded-2xl border border-neon/30 bg-card/60 p-4">
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Nombre</label>
      <input
        value={name} onChange={(e) => setName(e.target.value)} placeholder="Liga de los colegas"
        className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-neon"
      />
      <label className="mt-3 block text-[10px] uppercase tracking-widest text-muted-foreground">Saldo inicial por miembro (€)</label>
      <input
        type="number" min={100} value={stake} onChange={(e) => setStake(Math.max(100, Number(e.target.value) || 0))}
        className="mt-1 w-32 rounded-md border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-neon"
      />
      <button onClick={submit} disabled={busy || !name.trim()}
        className="mt-3 w-full rounded-lg bg-neon px-3 py-2 text-sm font-bold text-neon-foreground shadow-[var(--shadow-glow)] disabled:opacity-50">
        {busy ? "Creando..." : "Crear liga"}
      </button>
    </div>
  );
}

function JoinLeagueForm({ onDone }: { onDone: (id: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("join_league_by_code", { _code: code.trim() });
    setBusy(false);
    if (error || !data) { toast.error(error?.message ?? "Liga no encontrada"); return; }
    toast.success("¡Te has unido!");
    onDone(data as unknown as string);
  };
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Código de invitación</label>
      <div className="mt-1 flex gap-2">
        <input
          value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={12}
          className="flex-1 rounded-md border border-border bg-background/80 px-3 py-2 uppercase tracking-widest outline-none focus:border-neon"
        />
        <button onClick={submit} disabled={busy || !code.trim()}
          className="rounded-md bg-foreground px-4 text-sm font-bold text-background disabled:opacity-50">
          {busy ? "..." : "Unirme"}
        </button>
      </div>
    </div>
  );
}

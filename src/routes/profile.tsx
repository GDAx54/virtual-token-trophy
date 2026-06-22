import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Coins, Trophy, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { RequireAuth } from "@/components/RequireAuth";
import { AppHeader } from "@/components/AppHeader";
import { TabBar } from "@/components/TabBar";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Perfil · TokenBet" },
      { name: "description", content: "Tu perfil, bankroll y estadísticas." },
    ],
  }),
  component: () => <RequireAuth><ProfilePage /></RequireAuth>,
});

interface ProfileData { username: string; display_name: string | null; bankroll: number; total_won: number }

function ProfilePage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState({ active: 0, won: 0, lost: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username, display_name, bankroll, total_won").eq("id", user.id).single()
      .then(({ data }) => data && setProfile(data));
    supabase.from("bets").select("status").eq("user_id", user.id).then(({ data }) => {
      if (!data) return;
      setStats({
        active: data.filter((b) => b.status === "pending").length,
        won: data.filter((b) => b.status === "won").length,
        lost: data.filter((b) => b.status === "lost").length,
      });
    });
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Hasta luego");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen pb-24">
      <AppHeader subtitle="Mi perfil" />
      <main className="mx-auto max-w-3xl px-5 pt-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-center" style={{ backgroundImage: "var(--gradient-card)" }}>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-neon text-neon-foreground shadow-[var(--shadow-glow)]">
            <span className="text-xl font-bold">{(profile?.display_name ?? profile?.username ?? "?").slice(0, 2).toUpperCase()}</span>
          </div>
          <h1 className="mt-3 text-xl font-bold">{profile?.display_name || profile?.username || "—"}</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">@{profile?.username}</p>
          <p className="mt-3 text-xs text-muted-foreground">Tu saldo se gestiona por liga. Cámbiala desde la pestaña Ligas.</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Activas" value={stats.active} icon={<Receipt className="h-4 w-4" />} />
          <Stat label="Ganadas" value={stats.won} icon={<Trophy className="h-4 w-4 text-neon" />} />
          <Stat label="Total ganado" value={(profile?.total_won ?? 0).toLocaleString()} />
        </div>

        <button
          onClick={signOut}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/40 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </main>
      <TabBar />
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="mt-1 font-mono text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

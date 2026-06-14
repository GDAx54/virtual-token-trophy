import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

interface Profile { username: string; display_name: string | null; bankroll: number }

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const { user } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("username, display_name, bankroll")
      .eq("id", user.id)
      .single()
      .then(({ data }) => { if (!cancelled && data) setProfile(data); });

    // Realtime: keep bankroll in sync after a bet is placed/resolved
    const channel = supabase
      .channel(`profile:${user.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => setProfile(payload.new as Profile),
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
        <Link to="/">
          <div className="font-mono text-lg font-bold tracking-tight">
            token<span className="text-neon">bet</span>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {subtitle ?? (profile?.display_name ? `Hola, ${profile.display_name.split(" ")[0]}` : "Mundial 2026")}
          </p>
        </Link>
        <div className="flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-3 py-1.5">
          <Coins className="h-4 w-4 text-neon" />
          <span className="font-mono text-sm font-bold tabular-nums text-neon">
            {(profile?.bankroll ?? 0).toLocaleString()}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">tkn</span>
        </div>
      </div>
    </header>
  );
}

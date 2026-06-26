import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { setActiveLeagueId } from "@/hooks/use-active-league";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Unirse a una liga · 90x" },
      { name: "description", content: "Únete a la liga privada de un amigo." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/join/${code}` } as any, replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus("joining");
      const { data, error } = await supabase.rpc("join_league_by_code", { _code: code });
      if (cancelled) return;
      if (error || !data) {
        setStatus("error");
        setMsg(error?.message ?? "Liga no encontrada");
        return;
      }
      const leagueId = data as unknown as string;
      setActiveLeagueId(leagueId);
      setStatus("done");
      toast.success("¡Te has unido a la liga!");
      navigate({ to: "/leagues/$leagueId", params: { leagueId }, replace: true });
    })();
    return () => { cancelled = true; };
  }, [user, loading, code, navigate]);

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center" style={{ backgroundImage: "var(--gradient-card)" }}>
        <Trophy className="mx-auto h-10 w-10 text-neon" />
        <h1 className="mt-3 text-lg font-bold">Invitación a una liga</h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Código: {code}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          {status === "joining" && "Uniéndote a la liga..."}
          {status === "done" && "¡Listo! Redirigiendo..."}
          {status === "error" && (msg || "No se pudo unir.")}
          {status === "idle" && "Preparando..."}
        </p>
      </div>
    </div>
  );
}

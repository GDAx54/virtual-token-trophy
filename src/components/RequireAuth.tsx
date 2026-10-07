import { ReactNode, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

// Si no hay sesión, crea un jugador invitado (UUID anónimo) en segundo plano.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const started = useRef(false);

  useEffect(() => {
    if (loading || user || started.current) return;
    started.current = true;
    supabase.auth.signInAnonymously().then(({ error }) => {
      if (error) {
        started.current = false;
        toast.error("No se pudo crear tu perfil de invitado", { description: error.message });
      }
    });
  }, [loading, user]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}

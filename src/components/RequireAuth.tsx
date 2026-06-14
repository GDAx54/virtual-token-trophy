import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}

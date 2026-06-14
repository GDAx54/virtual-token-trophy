import { Link, useLocation } from "@tanstack/react-router";
import { Home, Trophy, Receipt, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/leagues", label: "Liga", icon: Trophy },
  { to: "/bets", label: "Apuestas", icon: Receipt },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-3xl grid-cols-4">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 py-3 font-mono text-[10px] uppercase tracking-widest transition-colors",
                active ? "text-neon" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {active && <span className="h-0.5 w-6 rounded-full bg-neon shadow-[var(--shadow-glow)]" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

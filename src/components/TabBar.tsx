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
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-4 gap-1 rounded-[1.35rem] border border-border/80 bg-card/90 p-1.5 shadow-[var(--shadow-dock)] backdrop-blur-xl">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-medium transition-all active:scale-95",
                active
                  ? "bg-neon/12 text-neon"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className={cn("grid h-6 w-8 place-items-center rounded-full transition-colors", active && "bg-neon/12")}>
                <Icon className={cn("h-[18px] w-[18px]", active && "stroke-[2.4]")} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

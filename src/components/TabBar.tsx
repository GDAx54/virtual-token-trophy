import { useLocation } from "@tanstack/react-router";
import { Home, Trophy, Receipt, User } from "lucide-react";
import { ExpandableTabs } from "@/components/ui/expandable-tabs";

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
      <ExpandableTabs
        tabs={TABS.map(({ to, label, icon }) => ({ to, title: label, icon }))}
        activePath={pathname}
        className="pointer-events-auto mx-auto max-w-md"
      />
    </nav>
  );
}

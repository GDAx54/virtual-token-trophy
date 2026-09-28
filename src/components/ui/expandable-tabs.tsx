import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TabPath = "/" | "/leagues" | "/bets" | "/profile";

export interface ExpandableTab {
  title: string;
  icon: LucideIcon;
  to: TabPath;
}

interface ExpandableTabsProps {
  tabs: readonly ExpandableTab[];
  activePath: string;
  className?: string;
}

const transition = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.45,
};

export function ExpandableTabs({ tabs, activePath, className }: ExpandableTabsProps) {
  return (
    <div
      className={cn(
        "flex h-[4.25rem] w-full items-center justify-center gap-1 rounded-[1.35rem] border border-border/80 bg-card/90 p-1.5 shadow-[var(--shadow-dock)] backdrop-blur-xl",
        className,
      )}
    >
      {tabs.map(({ title, icon: Icon, to }) => {
        const isSelected = activePath === to || (to === "/leagues" && activePath.startsWith("/leagues/"));

        return (
          <motion.div
            key={to}
            layout
            transition={transition}
            className={cn("min-w-0", isSelected ? "flex-[1.6]" : "flex-1")}
          >
            <Link
              to={to}
              aria-current={isSelected ? "page" : undefined}
              aria-label={title}
              className={cn(
                "flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl px-2 text-sm font-medium active:scale-95",
                isSelected
                  ? "gap-2 bg-neon/12 text-neon"
                  : "gap-0 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5 shrink-0", isSelected && "stroke-[2.4]")} />
              <AnimatePresence initial={false}>
                {isSelected && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {title}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
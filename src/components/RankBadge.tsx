import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RANKS, RANK_HELP } from "@/lib/duels";
import { cn } from "@/lib/utils";

const STYLES = [
  "border-border bg-muted text-muted-foreground",
  "border-neon/30 bg-neon/10 text-neon",
  "border-primary/40 bg-primary/10 text-primary",
  "border-accent/50 bg-accent/20 text-accent-foreground",
  "border-neon bg-neon text-neon-foreground",
];

export function RankBadge({ rank, leagueName, className }: { rank: number; leagueName?: string; className?: string }) {
  const r = RANKS[rank] ?? RANKS[0];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold", STYLES[rank] ?? STYLES[0], className)}
          aria-label={`Rango ${r.name}. Pulsa para ver cómo funciona`}
        >
          <span aria-hidden>{r.emoji}</span> {r.name}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs leading-relaxed">
        <div className="mb-1 font-bold">{r.emoji} {r.name}{leagueName ? ` · ${leagueName}` : ""}</div>
        <p className="text-muted-foreground">{RANK_HELP}</p>
        <p className="mt-2 text-muted-foreground">{RANKS.map((x) => `${x.emoji} ${x.name}`).join(" → ")}</p>
      </PopoverContent>
    </Popover>
  );
}

import * as React from "react";
import { icons, type LucideIcon } from "lucide-react";
import { Input, Label } from "@/components/ui";

/**
 * Searchable lucide icon picker for the Icon block's `name` prop. Lucide ships
 * ~1k icons, so we render a curated common set by default and only expand to the
 * full set when the user types a query (capped to keep the grid snappy — no full
 * 1k-node render). Selecting an icon stores its PascalCase name, which the Icon
 * block resolves at render time.
 */

const ALL_NAMES: string[] = Object.keys(icons).sort();
const ICONS = icons as Record<string, LucideIcon>;

/** A hand-picked set of common marketing icons shown before the user searches. */
const COMMON = [
  "Sparkles", "Star", "Heart", "Check", "CheckCircle", "Zap", "Rocket", "Flag",
  "ArrowRight", "ArrowUpRight", "ChevronRight", "Play", "Pause", "Globe", "Mail",
  "Phone", "MapPin", "Calendar", "Clock", "Users", "User", "Settings", "Search",
  "ShoppingCart", "CreditCard", "Lock", "Shield", "ShieldCheck", "Award", "Gift",
  "Bell", "Camera", "Image", "Video", "Music", "FileText", "Folder", "Cloud",
  "Download", "Upload", "Share2", "ThumbsUp", "MessageCircle", "Smile", "TrendingUp",
  "BarChart", "PieChart", "DollarSign", "Briefcase", "Building2", "Home", "Lightbulb",
  "Target", "Gauge", "Layers", "Code", "Database", "Server", "Cpu", "Wifi",
].filter((n) => ICONS[n]);

const CAP = 120; // max icons rendered at once

export const IconPickerField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
  const [q, setQ] = React.useState("");

  const results = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return COMMON;
    const matches: string[] = [];
    for (const n of ALL_NAMES) {
      if (n.toLowerCase().includes(query)) {
        matches.push(n);
        if (matches.length >= CAP) break;
      }
    }
    return matches;
  }, [q]);

  const Current = value ? ICONS[value] : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
          {Current ? <Current className="h-5 w-5" /> : <span className="text-[10px] text-muted-foreground">none</span>}
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={value ? `Selected: ${value} — search…` : "Search icons…"}
        />
      </div>
      <div className="grid max-h-44 grid-cols-7 gap-1 overflow-y-auto rounded-md border border-border p-1.5">
        {results.map((n) => {
          const Cmp = ICONS[n];
          const active = n === value;
          return (
            <button
              key={n}
              type="button"
              title={n}
              onClick={() => onChange(n)}
              className={`flex aspect-square items-center justify-center rounded hover:bg-accent ${
                active ? "bg-accent ring-1 ring-primary" : ""
              }`}
            >
              <Cmp className="h-4 w-4" />
            </button>
          );
        })}
        {results.length === 0 ? (
          <p className="col-span-7 p-2 text-center text-[11px] text-muted-foreground">No icons match “{q}”.</p>
        ) : null}
      </div>
      {q.trim() && results.length >= CAP ? (
        <p className="text-[11px] text-muted-foreground">Showing first {CAP} matches — refine your search.</p>
      ) : null}
    </div>
  );
};

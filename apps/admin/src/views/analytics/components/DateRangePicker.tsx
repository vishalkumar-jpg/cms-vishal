import * as React from "react";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui";
import type { AnalyticsRange } from "../api/analytics.api";
import {
  PRESET_DAYS,
  presetRange,
  type RangePreset,
} from "../lib/range";

interface DateRangePickerProps {
  preset: RangePreset;
  range: AnalyticsRange;
  onChange: (preset: RangePreset, range: AnalyticsRange) => void;
}

const PRESETS: Exclude<RangePreset, "custom">[] = ["7d", "28d", "90d"];

/**
 * Date-range picker driving all analytics queries. Three presets (7d / 28d /
 * 90d) plus a custom from/to. Emits both the preset id and the resolved range.
 */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  preset,
  range,
  onChange,
}) => {
  const selectPreset = (p: Exclude<RangePreset, "custom">): void => {
    onChange(p, presetRange(PRESET_DAYS[p]));
  };

  const setCustom = (patch: Partial<AnalyticsRange>): void => {
    const next = { ...range, ...patch };
    // Guard against an inverted range (from after to).
    if (next.from > next.to) return;
    onChange("custom", next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-md border border-border">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => selectPreset(p)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              preset === p
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={range.from}
          max={range.to}
          onChange={(e) => setCustom({ from: e.target.value })}
          className="h-9 w-[9.5rem]"
          aria-label="From date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={range.to}
          min={range.from}
          onChange={(e) => setCustom({ to: e.target.value })}
          className="h-9 w-[9.5rem]"
          aria-label="To date"
        />
      </div>
    </div>
  );
};

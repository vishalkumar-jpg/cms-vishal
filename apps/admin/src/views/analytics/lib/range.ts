import type { AnalyticsRange } from "../api/analytics.api";

/** Date-range preset ids for the analytics picker. */
export type RangePreset = "7d" | "28d" | "90d" | "custom";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Format a Date as a `YYYY-MM-DD` ISO date (UTC-safe, no time component). */
export const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

/** Build a range ending today (inclusive) spanning `days` days. */
export const presetRange = (days: number): AnalyticsRange => {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * DAY_MS);
  return { from: toISODate(from), to: toISODate(to) };
};

export const PRESET_DAYS: Record<Exclude<RangePreset, "custom">, number> = {
  "7d": 7,
  "28d": 28,
  "90d": 90,
};

export const PRESET_LABELS: Record<RangePreset, string> = {
  "7d": "Last 7 days",
  "28d": "Last 28 days",
  "90d": "Last 90 days",
  custom: "Custom",
};

/** Number of whole days covered by a range (inclusive), min 1. */
export const rangeDays = (range: AnalyticsRange): number => {
  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 1;
  return Math.max(1, Math.round((to - from) / DAY_MS) + 1);
};

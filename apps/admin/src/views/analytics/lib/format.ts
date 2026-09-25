/** Compact number formatting used across the analytics dashboard. */
export const fmtNum = (n: number | undefined | null): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat().format(n);
};

/** Seconds → `m:ss` (e.g. 95 → "1:35"). */
export const fmtDuration = (sec: number | undefined | null): string => {
  if (sec === undefined || sec === null || Number.isNaN(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

/** Fraction (0..1) → percentage string (e.g. 0.42 → "42%"). */
export const fmtPct = (frac: number | undefined | null): string => {
  if (frac === undefined || frac === null || Number.isNaN(frac)) return "—";
  return `${Math.round(frac * 100)}%`;
};

/**
 * Percentage change of `curr` vs `prev`. Returns null when a delta can't be
 * computed (no previous baseline), so callers can hide the trend chip.
 */
export const trendDelta = (curr: number, prev: number): number | null => {
  if (!prev || Number.isNaN(prev)) return null;
  return (curr - prev) / prev;
};

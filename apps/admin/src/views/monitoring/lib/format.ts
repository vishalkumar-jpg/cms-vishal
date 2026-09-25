/**
 * Shared PageSpeed score display helpers — used by dashboard, history, overview,
 * and export so colour bands stay consistent.
 */

/** Lighthouse score → colour band (>=90 good, >=50 needs-work, else poor). */
export const scoreClass = (v: number | null): string => {
  if (typeof v !== "number") return "text-muted-foreground";
  if (v >= 90) return "text-emerald-600";
  if (v >= 50) return "text-amber-600";
  return "text-red-600";
};

/** Format a score for UI (em-dash when absent). */
export const fmtScore = (v: number | null): string => (typeof v === "number" ? String(v) : "—");

/** Format a score for CSV/empty cells (blank when absent). */
export const fmtScoreCell = (v: number | null): string => (typeof v === "number" ? String(v) : "");

/** ISO timestamp → locale string; safe when missing or invalid. */
export const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

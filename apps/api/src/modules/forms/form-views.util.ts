/**
 * Form-view tracking lives in Redis (no schema change). The public render path
 * increments a per-form total + per-UTC-day counter; analytics reads them back
 * to compute a submissions/views conversion rate. View tracking is best-effort:
 * a Redis outage simply yields no view data (conversion is then null).
 */

/** Redis key for a form's all-time view counter. */
export function formViewsKey(formId: string): string {
  return `formviews:${formId}:total`;
}

/** Redis key for a form's view counter on a given UTC day (YYYY-MM-DD). */
export function formViewsDayKey(formId: string, day: string): string {
  return `formviews:${formId}:day:${day}`;
}

/** UTC day string (YYYY-MM-DD) for a date. */
export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Days kept for the per-day view rollup (expiry on the daily keys). */
export const FORM_VIEW_DAY_TTL_SECONDS = 60 * 60 * 24 * 120; // ~120 days

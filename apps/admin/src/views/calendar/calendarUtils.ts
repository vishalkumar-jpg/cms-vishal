/**
 * Dependency-free date helpers for the editorial calendar. All month/week math
 * is done in the browser's local timezone using native `Date`. Kept small and
 * pure so the grid + tests stay simple (no date lib is in package.json).
 */

export type CalendarMode = "month" | "week";

/** A single grid cell's date (midnight, local time). */
export interface CalendarDay {
  date: Date;
  /** ISO `YYYY-MM-DD` key (local) for O(1) event bucketing. */
  key: string;
  /** Whether this day belongs to the focused month (month view only). */
  inCurrentMonth: boolean;
  isToday: boolean;
}

/** Local `YYYY-MM-DD` key for a date (avoids UTC off-by-one from toISOString). */
export const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Same-calendar-day comparison (local). */
export const isSameDay = (a: Date, b: Date): boolean => dayKey(a) === dayKey(b);

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Start of the week (Sunday) containing `d`. */
export const startOfWeek = (d: Date): Date => {
  const s = startOfDay(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
};

export const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const addMonths = (d: Date, n: number): Date => {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return r;
};

/** Weekday short labels, Sunday-first. */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** e.g. "June 2026" (month view) or "Jun 21 – 27, 2026" (week view). */
export const rangeLabel = (focus: Date, mode: CalendarMode): string => {
  if (mode === "month") return `${MONTHS[focus.getMonth()]} ${focus.getFullYear()}`;
  const start = startOfWeek(focus);
  const end = addDays(start, 6);
  const startM = MONTHS[start.getMonth()].slice(0, 3);
  const endM = MONTHS[end.getMonth()].slice(0, 3);
  if (start.getMonth() === end.getMonth()) {
    return `${startM} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${startM} ${start.getDate()} – ${endM} ${end.getDate()}, ${end.getFullYear()}`;
};

/**
 * The days rendered for a given focus date + mode.
 *  - month: full weeks (Sun–Sat) covering the month → 5 or 6 rows of 7.
 *  - week: the 7 days of the focused week.
 */
export const buildDays = (focus: Date, mode: CalendarMode): CalendarDay[] => {
  const today = new Date();
  const toDay = (date: Date, inCurrentMonth: boolean): CalendarDay => ({
    date,
    key: dayKey(date),
    inCurrentMonth,
    isToday: isSameDay(date, today),
  });

  if (mode === "week") {
    const start = startOfWeek(focus);
    return Array.from({ length: 7 }, (_, i) => toDay(addDays(start, i), true));
  }

  const firstOfMonth = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const lastOfMonth = new Date(focus.getFullYear(), focus.getMonth() + 1, 0);
  const gridEnd = addDays(startOfWeek(lastOfMonth), 6);
  const total = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1;
  return Array.from({ length: total }, (_, i) => {
    const date = addDays(gridStart, i);
    return toDay(date, date.getMonth() === focus.getMonth());
  });
};

/** Inclusive [start, end] day-keys of the visible range (for empty-state checks). */
export const rangeBounds = (days: CalendarDay[]): { start: string; end: string } => ({
  start: days[0]?.key ?? "",
  end: days[days.length - 1]?.key ?? "",
});

/**
 * Shared UTC date/time helpers (Day.js + UTC plugin).
 *
 * Prefer these over `Date.now()`, `new Date()`, and `Date.parse()` anywhere
 * in application code. Values intended for persistence are ISO-8601 UTC
 * strings (trailing `Z`) unless a numeric epoch is explicitly required.
 */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);

export type UtcInput = string | number;

/** Current UTC instant as Unix epoch milliseconds. */
export function utcNowMs(): number {
  return dayjs.utc().valueOf();
}

/**
 * Current UTC instant as a `Date` (UTC wall time).
 * Prefer {@link utcNowIso} / {@link utcNowMs} at call sites when possible.
 */
export function utcNowDate(): Date {
  return dayjs.utc().toDate();
}

/** Current UTC instant as an ISO-8601 string (`…Z`). */
export function utcNowIso(): string {
  return dayjs.utc().toISOString();
}

/** Parse a value as UTC and return Unix epoch milliseconds. */
export function utcMillis(input: UtcInput): number {
  return dayjs.utc(input).valueOf();
}

/** Convert a value to an ISO-8601 UTC string (`…Z`). */
export function toUtcIso(input: UtcInput): string {
  return dayjs.utc(input).toISOString();
}

/** Whether `input` parses as a valid UTC instant. */
export function isValidUtc(input: UtcInput): boolean {
  return dayjs.utc(input).isValid();
}

/**
 * Format a UTC instant with a Day.js format string.
 * Default matches a full ISO-8601 UTC timestamp.
 */
export function formatUtc(
  input: UtcInput,
  template = "YYYY-MM-DDTHH:mm:ss.SSS[Z]",
): string {
  return dayjs.utc(input).format(template);
}

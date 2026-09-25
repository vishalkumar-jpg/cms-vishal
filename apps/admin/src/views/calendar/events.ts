/**
 * Turns page + post list rows into dated calendar events.
 *
 * Placement rules (each item can yield at most one event per range):
 *   - scheduled → `scheduledAt`   (pages carry scheduledAt; posts fall back to
 *                                  publishedAt, which the API sets to the future
 *                                  publish time when a post is scheduled)
 *   - published → `publishedAt`
 *   - expiring  → `expiresAt`      (only if the field exists on the row)
 *   - draft     → `updatedAt`      (opt-in via the "show drafts" toggle)
 *
 * We read rows loosely (fields like `expiresAt` may or may not exist depending
 * on concurrent API changes) so the calendar never hard-depends on a field the
 * list endpoint hasn't shipped yet.
 */
import type { PageSummary } from "@/views/pages/types";
import type { PostSummary } from "@/views/blog/types";
import { dayKey } from "./calendarUtils";

export type EventType = "page" | "post";
export type EventStatus = "draft" | "scheduled" | "published" | "expiring";

export interface CalendarEvent {
  id: string;
  /** The source row id (used to build the editor route). */
  entityId: string;
  type: EventType;
  status: EventStatus;
  title: string;
  /** Local `YYYY-MM-DD` bucket key. */
  dayKey: string;
  /** The date this event is placed on. */
  date: Date;
  /** Editor route for click-through. */
  href: string;
}

/** Loose accessor for an optional `expiresAt` that may not be in the typed row. */
const readExpiresAt = (row: Record<string, unknown>): string | null => {
  const v = row["expiresAt"];
  return typeof v === "string" ? v : null;
};

const parse = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

interface DeriveOptions {
  showDrafts: boolean;
}

const derivePage = (page: PageSummary, opts: DeriveOptions): CalendarEvent | null => {
  const href = `/pages/${page.id}/builder`;
  const base = { entityId: page.id, type: "page" as const, title: page.title, href };

  const expiresAt = parse(readExpiresAt(page as unknown as Record<string, unknown>));
  if (expiresAt) {
    return { ...base, id: `page-exp-${page.id}`, status: "expiring", date: expiresAt, dayKey: dayKey(expiresAt) };
  }

  const scheduledAt = parse(page.scheduledAt);
  if (page.status === "scheduled" && scheduledAt) {
    return { ...base, id: `page-sch-${page.id}`, status: "scheduled", date: scheduledAt, dayKey: dayKey(scheduledAt) };
  }

  const publishedAt = parse(page.publishedAt);
  if (page.status === "published" && publishedAt) {
    return { ...base, id: `page-pub-${page.id}`, status: "published", date: publishedAt, dayKey: dayKey(publishedAt) };
  }

  if (opts.showDrafts && page.status === "draft") {
    const updatedAt = parse(page.updatedAt);
    if (updatedAt) {
      return { ...base, id: `page-drf-${page.id}`, status: "draft", date: updatedAt, dayKey: dayKey(updatedAt) };
    }
  }
  return null;
};

const derivePost = (post: PostSummary, opts: DeriveOptions): CalendarEvent | null => {
  const href = `/blog/${post.id}/builder`;
  const base = { entityId: post.id, type: "post" as const, title: post.title, href };

  const expiresAt = parse(readExpiresAt(post as unknown as Record<string, unknown>));
  if (expiresAt) {
    return { ...base, id: `post-exp-${post.id}`, status: "expiring", date: expiresAt, dayKey: dayKey(expiresAt) };
  }

  // Posts have no scheduledAt column — the API stores the future publish time in
  // publishedAt while status stays "scheduled".
  const publishedAt = parse(post.publishedAt);
  if (post.status === "scheduled" && publishedAt) {
    return { ...base, id: `post-sch-${post.id}`, status: "scheduled", date: publishedAt, dayKey: dayKey(publishedAt) };
  }

  if (post.status === "published" && publishedAt) {
    return { ...base, id: `post-pub-${post.id}`, status: "published", date: publishedAt, dayKey: dayKey(publishedAt) };
  }

  if (opts.showDrafts && post.status === "draft") {
    const updatedAt = parse(post.updatedAt);
    if (updatedAt) {
      return { ...base, id: `post-drf-${post.id}`, status: "draft", date: updatedAt, dayKey: dayKey(updatedAt) };
    }
  }
  return null;
};

export interface DeriveInput {
  pages: PageSummary[];
  posts: PostSummary[];
  showDrafts: boolean;
}

/** All events for the given rows, unfiltered by range/type/status. */
export const deriveEvents = ({ pages, posts, showDrafts }: DeriveInput): CalendarEvent[] => {
  const opts = { showDrafts };
  const out: CalendarEvent[] = [];
  for (const p of pages) {
    const e = derivePage(p, opts);
    if (e) out.push(e);
  }
  for (const p of posts) {
    const e = derivePost(p, opts);
    if (e) out.push(e);
  }
  return out;
};

/** Group events by day key, sorted by time within each day. */
export const groupByDay = (events: CalendarEvent[]): Map<string, CalendarEvent[]> => {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const bucket = map.get(e.dayKey);
    if (bucket) bucket.push(e);
    else map.set(e.dayKey, [e]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  return map;
};

// -- status presentation ------------------------------------------------------

export const STATUS_META: Record<
  EventStatus,
  { label: string; dot: string; chip: string }
> = {
  draft: {
    label: "Draft",
    dot: "bg-muted-foreground",
    chip: "border-border bg-muted text-muted-foreground",
  },
  scheduled: {
    label: "Scheduled",
    dot: "bg-amber-500",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  published: {
    label: "Published",
    dot: "bg-emerald-500",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  expiring: {
    label: "Expiring",
    dot: "bg-red-500",
    chip: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

export const ALL_STATUSES: EventStatus[] = ["draft", "scheduled", "published", "expiring"];

import * as React from "react";
import { useNavigate } from "react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Newspaper,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, cn } from "@/components/ui";
import { useSiteStore } from "@/store/siteStore";
import { usePages } from "@/views/pages/hooks/usePages";
import { usePosts } from "@/views/blog/hooks/useBlog";
import {
  addDays,
  addMonths,
  buildDays,
  rangeLabel,
  WEEKDAYS,
  type CalendarMode,
} from "./calendarUtils";
import {
  ALL_STATUSES,
  deriveEvents,
  groupByDay,
  STATUS_META,
  type CalendarEvent,
  type EventStatus,
  type EventType,
} from "./events";

type TypeFilter = "all" | EventType;
type StatusFilter = "all" | EventStatus;

const TypeIcon: React.FC<{ type: EventType; className?: string }> = ({ type, className }) =>
  type === "page" ? (
    <FileText className={className} aria-label="Page" />
  ) : (
    <Newspaper className={className} aria-label="Post" />
  );

/** A single event chip inside a day cell. Click → open its editor. */
const EventChip: React.FC<{ event: CalendarEvent; onOpen: (e: CalendarEvent) => void }> = ({
  event,
  onOpen,
}) => {
  const meta = STATUS_META[event.status];
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      title={`${event.title} — ${event.type === "page" ? "Page" : "Post"} · ${meta.label}`}
      className={cn(
        "flex w-full items-center gap-1 rounded border px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors hover:brightness-95",
        meta.chip,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
      <TypeIcon type={event.type} className="h-3 w-3 shrink-0 opacity-70" />
      <span className="truncate">{event.title}</span>
    </button>
  );
};

const Legend: React.FC = () => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
    {ALL_STATUSES.map((s) => (
      <span key={s} className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)} />
        {STATUS_META[s].label}
      </span>
    ))}
    <span className="flex items-center gap-1.5">
      <FileText className="h-3.5 w-3.5" /> Page
    </span>
    <span className="flex items-center gap-1.5">
      <Newspaper className="h-3.5 w-3.5" /> Post
    </span>
  </div>
);

const MAX_PER_DAY = 3;

export const Calendar: React.FC = () => {
  const navigate = useNavigate();
  const siteId = useSiteStore((s) => s.activeSiteId);

  const [focus, setFocus] = React.useState<Date>(() => new Date());
  const [mode, setMode] = React.useState<CalendarMode>("month");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [showDrafts, setShowDrafts] = React.useState(false);
  const [expandedDay, setExpandedDay] = React.useState<string | null>(null);

  // Client-side reuse of the existing list endpoints. usePages needs siteId
  // explicitly; usePosts reads the active site from the store itself.
  const pagesQuery = usePages(siteId);
  const postsQuery = usePosts();

  const pages = pagesQuery.data ?? [];
  const posts = postsQuery.data ?? [];

  const isLoading = pagesQuery.isLoading || postsQuery.isLoading;
  const isError = pagesQuery.isError && postsQuery.isError;

  const days = React.useMemo(() => buildDays(focus, mode), [focus, mode]);

  const eventsByDay = React.useMemo(() => {
    const all = deriveEvents({ pages, posts, showDrafts });
    const filtered = all.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
    return groupByDay(filtered);
  }, [pages, posts, showDrafts, typeFilter, statusFilter]);

  const totalVisible = React.useMemo(
    () => days.reduce((n, d) => n + (eventsByDay.get(d.key)?.length ?? 0), 0),
    [days, eventsByDay],
  );

  const openEvent = React.useCallback(
    (e: CalendarEvent) => {
      void navigate(e.href);
    },
    [navigate],
  );

  const step = (dir: -1 | 1): void => {
    setExpandedDay(null);
    setFocus((f) => (mode === "month" ? addMonths(f, dir) : addDays(f, dir * 7)));
  };
  const goToday = (): void => {
    setExpandedDay(null);
    setFocus(new Date());
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      {/* Header + navigation */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Editorial Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Pages &amp; blog posts by publish date and status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border">
            <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => step(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToday} className="px-3">
              Today
            </Button>
            <Button variant="ghost" size="icon" aria-label="Next" onClick={() => step(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex overflow-hidden rounded-md border border-border">
            {(["month", "week"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setExpandedDay(null);
                  setMode(m);
                }}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  mode === m
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar: label + filters + legend */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-[12rem] text-lg font-semibold">{rangeLabel(focus, mode)}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="page">Pages</SelectItem>
              <SelectItem value="post">Posts</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showDrafts} onCheckedChange={setShowDrafts} />
            Drafts
          </label>
        </div>
      </div>

      <div className="mb-4">
        <Legend />
      </div>

      {/* States */}
      {!siteId ? (
        <div className="rounded-lg border border-border p-12 text-center text-sm text-muted-foreground">
          Select a website to view its editorial calendar.
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-12 text-center text-sm text-muted-foreground">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          Content APIs are unavailable. Try again shortly.
        </div>
      ) : (
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Weekday header */}
          <div className="grid grid-cols-7 overflow-hidden rounded-t-lg border border-b-0 border-border bg-muted/50 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-2">
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div
            className={cn(
              "grid grid-cols-7 overflow-hidden rounded-b-lg border border-border",
              mode === "week" && "min-h-[24rem]",
            )}
          >
            {days.map((day) => {
              const events = eventsByDay.get(day.key) ?? [];
              const isExpanded = expandedDay === day.key;
              const visible = isExpanded ? events : events.slice(0, MAX_PER_DAY);
              const overflow = events.length - visible.length;
              return (
                <div
                  key={day.key}
                  className={cn(
                    "flex min-h-[6.5rem] flex-col gap-1 border-b border-r border-border p-1.5",
                    mode === "week" && "min-h-[24rem]",
                    !day.inCurrentMonth && "bg-muted/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        day.isToday
                          ? "bg-primary text-primary-foreground"
                          : day.inCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/60",
                      )}
                    >
                      {day.date.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {visible.map((e) => (
                      <EventChip key={e.id} event={e} onOpen={openEvent} />
                    ))}
                    {overflow > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedDay(day.key)}
                        className="rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        +{overflow} more
                      </button>
                    )}
                    {isExpanded && events.length > MAX_PER_DAY && (
                      <button
                        type="button"
                        onClick={() => setExpandedDay(null)}
                        className="rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!isLoading && totalVisible === 0 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              No content in this range. Adjust the filters or navigate to another {mode}.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

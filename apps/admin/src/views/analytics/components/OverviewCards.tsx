import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtDuration, fmtNum, fmtPct, trendDelta } from "../lib/format";
import type { AnalyticsOverview } from "../api/analytics.api";

interface StatCardProps {
  label: string;
  value: string;
  /** Trend fraction vs previous period; null hides the chip. */
  delta: number | null;
  /** When true a positive delta is "bad" (e.g. bounce rate) — inverts color. */
  invert?: boolean;
}

const TrendChip: React.FC<{ delta: number | null; invert?: boolean }> = ({
  delta,
  invert,
}) => {
  if (delta === null) {
    return <span className="text-xs text-muted-foreground">no prior data</span>;
  }
  const flat = Math.abs(delta) < 0.005;
  const up = delta > 0;
  const good = flat ? true : invert ? !up : up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        flat
          ? "text-muted-foreground"
          : good
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {fmtPct(Math.abs(delta))}
    </span>
  );
};

const StatCard: React.FC<StatCardProps> = ({ label, value, delta, invert }) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <div className="mt-1 flex items-baseline justify-between gap-2">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <TrendChip delta={delta} invert={invert} />
    </div>
    <p className="mt-1 text-[11px] text-muted-foreground">vs previous period</p>
  </div>
);

const SkeletonCard: React.FC = () => (
  <div className="rounded-lg border border-border bg-card p-4">
    <div className="h-3 w-20 rounded bg-muted" />
    <div className="mt-3 h-7 w-24 rounded bg-muted" />
    <div className="mt-3 h-2 w-28 rounded bg-muted/60" />
  </div>
);

export const OverviewCards: React.FC<{
  data: AnalyticsOverview | undefined;
  isLoading: boolean;
  isError: boolean;
}> = ({ data, isLoading, isError }) => {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isError ? (
          <p className="col-span-full py-4 text-sm text-muted-foreground">
            Could not load overview stats.
          </p>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Visitors"
        value={fmtNum(data.visitors)}
        delta={trendDelta(data.visitors, data.prev.visitors)}
      />
      <StatCard
        label="Pageviews"
        value={fmtNum(data.pageviews)}
        delta={trendDelta(data.pageviews, data.prev.pageviews)}
      />
      <StatCard label="Avg session" value={fmtDuration(data.avgSessionSec)} delta={null} />
      <StatCard label="Bounce rate" value={fmtPct(data.bounceRate)} delta={null} invert />
    </div>
  );
};

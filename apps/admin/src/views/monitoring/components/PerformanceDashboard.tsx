import * as React from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { AuditDashboardSummary, DashboardPage } from "../api/monitoring.api";
import { fmtScore, scoreClass, fmtDateTime } from "../lib/format";

const fmtDuration = (ms: number | null): string => {
  if (typeof ms !== "number") return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.round(s / 60)} min`;
};

/** Overall-health label + colour from the site health score. */
const healthLabel = (v: number | null): { text: string; cls: string } => {
  if (typeof v !== "number") return { text: "No data", cls: "text-muted-foreground" };
  if (v >= 90) return { text: "Healthy", cls: "text-emerald-600" };
  if (v >= 50) return { text: "Needs work", cls: "text-amber-600" };
  return { text: "Poor", cls: "text-red-600" };
};

const MetaItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="truncate text-xs">{children}</div>
  </div>
);

/** Small up/down/flat indicator for a score delta (null when no baseline). */
const Trend: React.FC<{ current: number | null; previous: number | null }> = ({ current, previous }) => {
  if (typeof current !== "number" || typeof previous !== "number") return null;
  const delta = current - previous;
  if (delta === 0)
    return (
      <span className="inline-flex items-center text-[11px] text-muted-foreground">
        <Minus className="mr-0.5 h-3 w-3" />0
      </span>
    );
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center text-[11px] ${up ? "text-emerald-600" : "text-red-600"}`}>
      {up ? <TrendingUp className="mr-0.5 h-3 w-3" /> : <TrendingDown className="mr-0.5 h-3 w-3" />}
      {up ? "+" : ""}
      {delta}
    </span>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: number | null;
  trend?: { current: number | null; previous: number | null };
}> = ({ label, value, trend }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 flex items-baseline gap-2">
      <span className={`text-2xl font-semibold ${scoreClass(value)}`}>{fmtScore(value)}</span>
      {trend && <Trend current={trend.current} previous={trend.previous} />}
    </div>
  </div>
);

const RankedList: React.FC<{
  title: string;
  pages: DashboardPage[];
  onSelectPath: (p: string) => void;
}> = ({ title, pages, onSelectPath }) => {
  if (pages.length === 0) return null;
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {pages.map((p) => (
          <li key={p.auditId}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-muted/60"
              onClick={() => onSelectPath(p.path)}
              title={p.path}
            >
              <span className="min-w-0 flex-1 truncate">{p.path}</span>
              <span className={`shrink-0 font-semibold ${scoreClass(p.average)}`}>{fmtScore(p.average)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Site-wide PageSpeed dashboard: overall health + category averages (with trend
 * vs each page's previous scan) and the best / lowest performing pages. All data
 * comes from the existing page_audits rollup.
 */
export const PerformanceDashboard: React.FC<{
  summary: AuditDashboardSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  onSelectPath: (path: string) => void;
}> = ({ summary, isLoading, isError, onSelectPath }) => {
  if (isLoading) return <p className="mb-4 text-sm text-muted-foreground">Loading dashboard…</p>;
  if (isError && !summary) {
    return <p className="mb-4 text-sm text-muted-foreground">Could not load the dashboard.</p>;
  }
  if (!summary || summary.counts.pages === 0) return null;

  const a = summary.averages;
  const health = healthLabel(summary.health);
  return (
    <div className="mb-5">
      {isError && (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
          Showing cached dashboard data — refresh failed.
        </p>
      )}
      <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetaItem label="Site health">
          <span className={`font-semibold ${health.cls}`}>{health.text}</span>
        </MetaItem>
        <MetaItem label="Pages scanned">
          {summary.counts.completed}/{summary.counts.pages}
        </MetaItem>
        <MetaItem label="Last scan">{fmtDateTime(summary.lastScanAt)}</MetaItem>
        <MetaItem label="Avg scan time">{fmtDuration(summary.avgScanDurationMs)}</MetaItem>
        <MetaItem label="Next scheduled">
          {summary.schedule?.enabled ? fmtDateTime(summary.nextScanAt) : "Off"}
        </MetaItem>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Health" value={summary.health} trend={{ current: summary.health, previous: summary.previousHealth }} />
        <SummaryCard label="Performance" value={a.performanceScore} />
        <SummaryCard label="Accessibility" value={a.accessibilityScore} />
        <SummaryCard label="Best practices" value={a.bestPracticesScore} />
        <SummaryCard label="SEO" value={a.seoScore} />
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pages</div>
          <div className="mt-1 text-2xl font-semibold">{summary.counts.pages}</div>
          <div className="text-[10px] text-muted-foreground">{summary.counts.completed} completed</div>
        </div>
      </div>
      {(summary.best.length > 0 || summary.worst.length > 0) && (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <RankedList title="Best performing" pages={summary.best} onSelectPath={onSelectPath} />
          <RankedList title="Lowest performing" pages={summary.worst} onSelectPath={onSelectPath} />
        </div>
      )}
    </div>
  );
};

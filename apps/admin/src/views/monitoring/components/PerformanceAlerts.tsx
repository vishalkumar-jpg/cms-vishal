import * as React from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, TrendingDown } from "lucide-react";
import type { AuditDashboardSummary, PageAuditAlert, RegressionPage } from "../api/monitoring.api";

const METRIC_LABELS: Record<string, string> = {
  performance: "Performance",
  accessibility: "Accessibility",
  seo: "SEO",
  bestPractices: "Best practices",
  lcp: "LCP",
  cls: "CLS",
};

const fmtBreachValue = (metric: string, value: number | null): string => {
  if (typeof value !== "number") return "—";
  if (metric === "lcp") return `${Math.round(value)} ms`;
  if (metric === "cls") return value.toFixed(3);
  return String(value);
};

const AlertRow: React.FC<{ alert: PageAuditAlert; onSelectPath: (p: string) => void }> = ({
  alert,
  onSelectPath,
}) => (
  <li className="rounded border border-red-200 bg-red-50/60 p-2 dark:border-red-900/50 dark:bg-red-950/20">
    <button
      type="button"
      className="mb-1 block max-w-full truncate text-left text-xs font-medium hover:underline"
      onClick={() => onSelectPath(alert.path)}
      title={alert.path}
    >
      {alert.path}
    </button>
    <div className="flex flex-wrap gap-1">
      {alert.breaches.map((b) => (
        <span
          key={b.metric}
          className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300"
          title={`${b.lowerIsBetter ? "above" : "below"} threshold ${fmtBreachValue(b.metric, b.threshold)}`}
        >
          {METRIC_LABELS[b.metric] ?? b.metric}: {fmtBreachValue(b.metric, b.value)}
        </span>
      ))}
    </div>
  </li>
);

const RegressionList: React.FC<{
  title: string;
  icon: React.ReactNode;
  pages: RegressionPage[];
  onSelectPath: (p: string) => void;
  positive?: boolean;
}> = ({ title, icon, pages, onSelectPath, positive }) => {
  if (pages.length === 0) return null;
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        {title}
      </p>
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
              <span className={`shrink-0 font-semibold ${positive ? "text-emerald-600" : "text-red-600"}`}>
                {p.delta > 0 ? "+" : ""}
                {p.delta}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Performance Alerts + Regression Detection (Phase 5). Surfaces pages whose
 * latest scan breached the configured thresholds, plus the largest average
 * drops, newly-failing pages, and pages improving over time — all derived from
 * the existing dashboard rollup (no extra requests).
 */
export const PerformanceAlerts: React.FC<{
  summary: AuditDashboardSummary | undefined;
  onSelectPath: (path: string) => void;
}> = ({ summary, onSelectPath }) => {
  if (!summary) return null;
  const { alertingPages, regressions } = summary;
  const hasRegressions =
    regressions.largestDrops.length > 0 ||
    regressions.newlyFailing.length > 0 ||
    regressions.improving.length > 0;

  if (alertingPages.length === 0 && !hasRegressions) return null;

  return (
    <div className="mb-5 space-y-3">
      {alertingPages.length > 0 && (
        <div className="rounded-lg border border-red-200 p-3 dark:border-red-900/50">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {alertingPages.length} page{alertingPages.length === 1 ? "" : "s"} outside threshold
          </p>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {alertingPages.map((a) => (
              <AlertRow key={a.auditId} alert={a} onSelectPath={onSelectPath} />
            ))}
          </ul>
        </div>
      )}
      {hasRegressions && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <RegressionList
            title="Largest regressions"
            icon={<TrendingDown className="h-3.5 w-3.5 text-red-600" />}
            pages={regressions.largestDrops}
            onSelectPath={onSelectPath}
          />
          <RegressionList
            title="Newly failing"
            icon={<ArrowDownRight className="h-3.5 w-3.5 text-red-600" />}
            pages={regressions.newlyFailing}
            onSelectPath={onSelectPath}
          />
          <RegressionList
            title="Improving"
            icon={<ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />}
            pages={regressions.improving}
            onSelectPath={onSelectPath}
            positive
          />
        </div>
      )}
    </div>
  );
};

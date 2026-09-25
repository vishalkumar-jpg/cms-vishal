import * as React from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Button, Input } from "@/components/ui";
import type { PageAudit } from "../api/monitoring.api";
import { fmtScore, scoreClass } from "../lib/format";
import { TrendSparkline } from "./TrendSparkline";

/** latest→previous delta for a metric (higher-is-better unless `lowerBetter`). */
const Delta: React.FC<{ current: number | null; previous: number | null; lowerBetter?: boolean }> = ({
  current,
  previous,
  lowerBetter,
}) => {
  if (typeof current !== "number" || typeof previous !== "number") return null;
  const diff = current - previous;
  if (diff === 0)
    return (
      <span className="inline-flex items-center text-[11px] text-muted-foreground">
        <ArrowRight className="mr-0.5 h-3 w-3" />0
      </span>
    );
  const improved = lowerBetter ? diff < 0 : diff > 0;
  return (
    <span className={`inline-flex items-center text-[11px] ${improved ? "text-emerald-600" : "text-red-600"}`}>
      {diff > 0 ? <ArrowUp className="mr-0.5 h-3 w-3" /> : <ArrowDown className="mr-0.5 h-3 w-3" />}
      {diff > 0 ? "+" : ""}
      {Number.isInteger(diff) ? diff : diff.toFixed(3)}
    </span>
  );
};

const CompareCell: React.FC<{
  label: string;
  current: number | null;
  previous: number | null;
  lowerBetter?: boolean;
  fmt?: (v: number | null) => string;
}> = ({ label, current, previous, lowerBetter, fmt = fmtScore }) => (
  <div className="rounded-md border border-border bg-muted/30 p-2 text-center">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`text-lg font-semibold ${lowerBetter ? "" : scoreClass(current)}`}>{fmt(current)}</div>
    <Delta current={current} previous={previous} lowerBetter={lowerBetter} />
  </div>
);

/**
 * Scan History for a single page: a date-range filter plus a latest-vs-previous
 * comparison of the two most recent scans (score improvements/regressions for
 * the four Lighthouse categories + Core Web Vitals). The per-scan detail lives
 * in the audit cards below; this is the at-a-glance trend.
 */
export const ScanHistory: React.FC<{
  path: string;
  rows: PageAudit[];
  onDateChange: (from?: string, to?: string) => void;
}> = ({ path, rows, onDateChange }) => {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  // Mirror local date inputs when the parent-selected path changes.
  React.useEffect(() => {
    setFrom("");
    setTo("");
  }, [path]);

  const apply = (nextFrom: string, nextTo: string): void => {
    onDateChange(
      nextFrom ? new Date(`${nextFrom}T00:00:00`).toISOString() : undefined,
      nextTo ? new Date(`${nextTo}T23:59:59.999`).toISOString() : undefined,
    );
  };

  const clear = (): void => {
    setFrom("");
    setTo("");
    onDateChange(undefined, undefined);
  };

  const latest = rows[0] ?? null;
  const prev = rows[1] ?? null;

  // Trend series are oldest→newest (rows arrive newest-first), capped so the
  // sparklines stay readable. Reuses the existing history — no extra request.
  const series = React.useMemo(() => {
    const ordered = [...rows].reverse().slice(-20);
    return {
      performance: ordered.map((r) => r.performanceScore),
      accessibility: ordered.map((r) => r.accessibilityScore),
      bestPractices: ordered.map((r) => r.bestPracticesScore),
      seo: ordered.map((r) => r.seoScore),
      lcp: ordered.map((r) => r.lcp),
      cls: ordered.map((r) => r.cls),
    };
  }, [rows]);

  return (
    <div className="mb-4 rounded-lg border border-border p-3">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <p className="text-sm font-medium">Scan history</p>
          <p className="truncate text-xs text-muted-foreground" title={path}>
            {path} · {rows.length} scan{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            From
            <Input
              type="date"
              value={from}
              className="h-8 w-36"
              onChange={(e) => {
                setFrom(e.target.value);
                apply(e.target.value, to);
              }}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            To
            <Input
              type="date"
              value={to}
              className="h-8 w-36"
              onChange={(e) => {
                setTo(e.target.value);
                apply(from, e.target.value);
              }}
            />
          </label>
          {(from || to) && (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No scans in this range.</p>
      ) : !prev ? (
        <p className="text-xs text-muted-foreground">
          Only one scan — run this page again to compare improvements and regressions.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <CompareCell label="Perf" current={latest?.performanceScore ?? null} previous={prev.performanceScore} />
          <CompareCell label="A11y" current={latest?.accessibilityScore ?? null} previous={prev.accessibilityScore} />
          <CompareCell label="Best" current={latest?.bestPracticesScore ?? null} previous={prev.bestPracticesScore} />
          <CompareCell label="SEO" current={latest?.seoScore ?? null} previous={prev.seoScore} />
          <CompareCell
            label="LCP"
            current={latest?.lcp ?? null}
            previous={prev.lcp}
            lowerBetter
            fmt={(v) => (typeof v === "number" ? `${(v / 1000).toFixed(1)}s` : "—")}
          />
          <CompareCell
            label="CLS"
            current={latest?.cls ?? null}
            previous={prev.cls}
            lowerBetter
            fmt={(v) => (typeof v === "number" ? v.toFixed(3) : "—")}
          />
        </div>
      )}

      {rows.length >= 2 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Trends over time</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <TrendSparkline label="Perf" values={series.performance} domain={[0, 100]} color="#6366f1" />
            <TrendSparkline label="A11y" values={series.accessibility} domain={[0, 100]} color="#0ea5e9" />
            <TrendSparkline label="Best" values={series.bestPractices} domain={[0, 100]} color="#10b981" />
            <TrendSparkline label="SEO" values={series.seo} domain={[0, 100]} color="#f59e0b" />
            <TrendSparkline
              label="LCP"
              values={series.lcp}
              color="#ef4444"
              fmt={(v) => (typeof v === "number" ? `${(v / 1000).toFixed(1)}s` : "—")}
            />
            <TrendSparkline
              label="CLS"
              values={series.cls}
              color="#ef4444"
              fmt={(v) => (typeof v === "number" ? v.toFixed(3) : "—")}
            />
          </div>
        </div>
      )}
    </div>
  );
};

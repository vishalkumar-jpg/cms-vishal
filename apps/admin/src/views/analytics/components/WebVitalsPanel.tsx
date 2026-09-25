import * as React from "react";
import type { WebVitalMetric, WebVitals } from "../api/analytics.api";

interface VitalConfig {
  key: keyof WebVitals;
  label: string;
  /** Format the raw p75 value for display. */
  format: (v: number) => string;
}

const VITALS: VitalConfig[] = [
  { key: "lcp", label: "LCP", format: (v) => `${(v / 1000).toFixed(2)} s` },
  { key: "cls", label: "CLS", format: (v) => v.toFixed(2) },
  { key: "inp", label: "INP", format: (v) => `${Math.round(v)} ms` },
];

/** Stacked good / needs-improvement / poor distribution bar. */
const DistBar: React.FC<{ metric: WebVitalMetric }> = ({ metric }) => {
  const total = metric.good + metric.ni + metric.poor || 1;
  const pct = (n: number) => (n / total) * 100;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-emerald-500" style={{ width: `${pct(metric.good)}%` }} />
        <div className="h-full bg-amber-500" style={{ width: `${pct(metric.ni)}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${pct(metric.poor)}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{Math.round(pct(metric.good))}% good</span>
        <span>{Math.round(pct(metric.ni))}% NI</span>
        <span>{Math.round(pct(metric.poor))}% poor</span>
      </div>
    </div>
  );
};

export const WebVitalsPanel: React.FC<{ data: WebVitals }> = ({ data }) => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
    {VITALS.map(({ key, label, format }) => {
      const metric = data[key];
      return (
        <div key={key} className="rounded-md border border-border p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className="text-lg font-semibold tabular-nums">{format(metric.p75)}</span>
          </div>
          <DistBar metric={metric} />
          <p className="mt-1 text-[10px] text-muted-foreground">p75 across sessions</p>
        </div>
      );
    })}
  </div>
);

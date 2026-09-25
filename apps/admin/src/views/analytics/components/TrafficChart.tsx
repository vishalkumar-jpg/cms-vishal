import * as React from "react";
import { fmtNum } from "../lib/format";
import type { TimeseriesPoint } from "../api/analytics.api";

/**
 * Lightweight dependency-free timeseries chart (SVG). Renders a filled
 * visitors area plus a pageviews line over a shared, responsive viewBox so it
 * scales to its container. No charting library — pure SVG/CSS.
 */
const W = 720;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 22, left: 12 };

const buildPath = (
  points: number[],
  max: number,
  close: boolean,
): string => {
  const n = points.length;
  if (n === 0) return "";
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (max <= 0 ? 0 : (v / max) * innerH);
  let d = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  if (close) {
    d += ` L${x(n - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`;
  }
  return d;
};

export const TrafficChart: React.FC<{ data: TimeseriesPoint[] }> = ({ data }) => {
  const visitors = data.map((p) => p.visitors);
  const pageviews = data.map((p) => p.pageviews);
  const max = Math.max(1, ...visitors, ...pageviews);

  const firstLabel = data[0]?.date ?? "";
  const lastLabel = data[data.length - 1]?.date ?? "";

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-primary/60" /> Visitors
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-sm bg-sky-500" /> Pageviews
        </span>
        <span className="ml-auto">peak {fmtNum(max)}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Traffic over time"
      >
        <path d={buildPath(visitors, max, true)} className="fill-primary/15" />
        <path
          d={buildPath(visitors, max, false)}
          className="fill-none stroke-primary/70"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={buildPath(pageviews, max, false)}
          className="fill-none stroke-sky-500"
          strokeWidth={2}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
};

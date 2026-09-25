import * as React from "react";

/**
 * Dependency-free inline SVG sparkline for a metric's history (Phase 5). Points
 * are oldest→newest. No chart library — just a normalized polyline + endpoint
 * dot, so it stays light and consistent with the existing design system.
 */
export const TrendSparkline: React.FC<{
  label: string;
  values: (number | null)[];
  /** Fixed value domain (e.g. [0,100] for scores). Auto-scales when omitted. */
  domain?: [number, number];
  /** Colour for the line + latest dot. */
  color?: string;
  /** Formats the latest value shown beside the label. */
  fmt?: (v: number | null) => string;
  width?: number;
  height?: number;
}> = ({ label, values, domain, color = "#6366f1", fmt = (v) => (v === null ? "—" : String(v)), width = 120, height = 32 }) => {
  const coords: Array<{ x: number; y: number }> = [];
  let latest: number | null = null;
  const numeric = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => typeof p.v === "number");
  for (let i = values.length - 1; i >= 0; i--) {
    if (typeof values[i] === "number") {
      latest = values[i];
      break;
    }
  }

  let path: string | null = null;
  let lastPt: { x: number; y: number } | null = null;
  if (numeric.length >= 2 && values.length >= 2) {
    const nums = numeric.map((p) => p.v);
    const min = domain ? domain[0] : Math.min(...nums);
    const max = domain ? domain[1] : Math.max(...nums);
    const span = max - min || 1;
    const pad = 3;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const denom = Math.max(values.length - 1, 1);
    for (const { v, i } of numeric) {
      const x = pad + (i / denom) * innerW;
      const y = pad + innerH - ((v - min) / span) * innerH;
      coords.push({ x, y });
    }
    path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    lastPt = coords[coords.length - 1] ?? null;
  }

  return (
    <div className="rounded-md border border-border p-2">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>
          {fmt(latest)}
        </span>
      </div>
      {path ? (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${label} trend`}>
          <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r={2} fill={color} />}
        </svg>
      ) : (
        <div className="flex h-8 items-center text-[10px] text-muted-foreground">Not enough data</div>
      )}
    </div>
  );
};

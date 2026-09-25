import * as React from "react";
import { fmtNum } from "../lib/format";
import type { DeviceBreakdown } from "../api/analytics.api";

const COLORS = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#94a3b8"];

/** Donut chart (SVG stroke-dasharray) + legend for the device breakdown. */
export const DevicesDonut: React.FC<{ data: DeviceBreakdown[] }> = ({ data }) => {
  const rows = [...data].sort((a, b) => b.visitors - a.visitors);
  const total = rows.reduce((sum, d) => sum + d.visitors, 0) || 1;

  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label="Devices">
        <g transform="rotate(-90 80 80)">
          {rows.map((d, i) => {
            const frac = d.visitors / total;
            const len = frac * C;
            const seg = (
              <circle
                key={d.device}
                cx={80}
                cy={80}
                r={R}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={20}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return seg;
          })}
        </g>
        <text
          x={80}
          y={76}
          textAnchor="middle"
          className="fill-foreground text-lg font-semibold"
        >
          {fmtNum(total)}
        </text>
        <text x={80} y={94} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          visitors
        </text>
      </svg>

      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((d, i) => (
          <li key={d.device} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="capitalize">{d.device || "unknown"}</span>
            <span className="tabular-nums text-muted-foreground">
              {Math.round((d.visitors / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

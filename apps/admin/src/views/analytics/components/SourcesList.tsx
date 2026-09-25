import * as React from "react";
import { fmtNum } from "../lib/format";
import type { TrafficSource } from "../api/analytics.api";

/** Horizontal bar list of traffic sources by visitor share. */
export const SourcesList: React.FC<{ data: TrafficSource[] }> = ({ data }) => {
  const total = data.reduce((sum, s) => sum + s.visitors, 0) || 1;
  const rows = [...data].sort((a, b) => b.visitors - a.visitors);

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((s) => {
        const pct = (s.visitors / total) * 100;
        return (
          <li key={s.source}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="truncate font-medium capitalize" title={s.source}>
                {s.source || "(direct)"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {fmtNum(s.visitors)} · {Math.round(pct)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

import * as React from "react";
import { useSiteStore } from "@/store/siteStore";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { presetRange, PRESET_DAYS, type RangePreset } from "@/views/analytics/lib/range";
import type { AnalyticsRange } from "@/views/analytics/api/analytics.api";
import { DateRangePicker } from "@/views/analytics/components/DateRangePicker";
import {
  useAttributionConversions,
  useAttributionModels,
  useAttributionOverview,
} from "./hooks/useAttribution";
import type { AttributionBreakdownRow, AttributionModel } from "./api/attribution.api";

const MODELS: { id: AttributionModel; label: string }[] = [
  { id: "first", label: "First touch" },
  { id: "last", label: "Last touch" },
  { id: "linear", label: "Linear" },
  { id: "position", label: "Position" },
];

const money = (n: number): string =>
  n >= 0 ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `-$${Math.abs(n)}`;
const num = (n: number): string => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/**
 * Attribution (Phase 5). Marketing attribution over the analytics touchpoint
 * stream: overview cards, by-source / by-campaign / by-landing-page tables under
 * the selected model, and a first-vs-last-vs-linear model comparison. Reuses the
 * analytics DateRangePicker + range lib.
 */
export const Attribution: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [preset, setPreset] = React.useState<RangePreset>("28d");
  const [range, setRange] = React.useState<AnalyticsRange>(() => presetRange(PRESET_DAYS["28d"]));
  const [model, setModel] = React.useState<AttributionModel>("last");

  const onRangeChange = (p: RangePreset, r: AnalyticsRange): void => {
    setPreset(p);
    setRange(r);
  };

  const overview = useAttributionOverview(range, model);
  const models = useAttributionModels(range);
  const conversions = useAttributionConversions(range);

  if (!siteId) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8 text-sm text-muted-foreground">
        Select a site to view attribution.
      </div>
    );
  }

  const totals = overview.data?.totals;
  const topSource = overview.data?.bySource[0];
  const topCampaign = overview.data?.byCampaign[0];

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Attribution</h1>
          <p className="text-sm text-muted-foreground">
            Revenue and conversions credited across marketing touchpoints.
          </p>
        </div>
        <DateRangePicker preset={preset} range={range} onChange={onRangeChange} />
      </div>

      {/* Model selector */}
      <div className="mb-6 inline-flex overflow-hidden rounded-md border border-border">
        {MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModel(m.id)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              model === m.id
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {/* Overview cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Conversions" value={totals ? num(totals.conversions) : "—"} loading={overview.isLoading} />
          <StatCard label="Revenue" value={totals ? money(totals.value) : "—"} loading={overview.isLoading} />
          <StatCard label="Top source" value={topSource?.key ?? "—"} loading={overview.isLoading} />
          <StatCard label="Top campaign" value={topCampaign?.key ?? "—"} loading={overview.isLoading} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BreakdownTable
            title="By source"
            rows={overview.data?.bySource ?? []}
            loading={overview.isLoading}
            error={overview.isError}
          />
          <BreakdownTable
            title="By campaign"
            rows={overview.data?.byCampaign ?? []}
            loading={overview.isLoading}
            error={overview.isError}
          />
        </div>

        <BreakdownTable
          title="By landing page"
          rows={overview.data?.byLandingPage ?? []}
          loading={overview.isLoading}
          error={overview.isError}
        />

        {/* Model comparison */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Model comparison</h2>
            <p className="text-xs text-muted-foreground">
              Revenue credited by source under first / last / linear touch.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
            {(models.data?.models ?? []).map((m) => (
              <div key={m.model} className="rounded-md border border-border">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.model}
                  </span>
                  <Badge variant="secondary">{money(m.totalValue)}</Badge>
                </div>
                <table className="w-full min-w-[640px] text-sm">
                  <tbody className="divide-y divide-border">
                    {m.bySource.slice(0, 6).map((r) => (
                      <tr key={r.key}>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.key}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{money(r.value)}</td>
                      </tr>
                    ))}
                    {m.bySource.length === 0 && (
                      <tr>
                        <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={2}>
                          No data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
            {models.isLoading && (
              <div className="p-4 text-sm text-muted-foreground">Loading comparison…</div>
            )}
          </div>
        </div>

        {/* Recent conversions */}
        <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0 bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Recent conversions</h2>
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Label</th>
                <th className="px-4 py-2 font-medium">Landing</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(conversions.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(c.ts).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{c.label ?? c.type}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.landingPath ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(c.value)}</td>
                </tr>
              ))}
              {(conversions.data?.length ?? 0) === 0 && !conversions.isLoading && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={4}>
                    No conversions recorded in this range yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; loading?: boolean }> = ({
  label,
  value,
  loading,
}) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 truncate text-2xl font-semibold">{loading ? "…" : value}</div>
  </div>
);

const BreakdownTable: React.FC<{
  title: string;
  rows: AttributionBreakdownRow[];
  loading?: boolean;
  error?: boolean;
}> = ({ title, rows, loading, error }) => (
  <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0 bg-card">
    <div className="border-b border-border px-4 py-3">
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
    <table className="w-full min-w-[640px] text-sm">
      <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="px-4 py-2 font-medium">Key</th>
          <th className="px-4 py-2 text-right font-medium">Conversions</th>
          <th className="px-4 py-2 text-right font-medium">Revenue</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="px-4 py-2 truncate">{r.key}</td>
            <td className="px-4 py-2 text-right tabular-nums">{num(r.conversions)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{money(r.value)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={3}>
              {loading ? "Loading…" : error ? "Could not load." : "No data for this range."}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

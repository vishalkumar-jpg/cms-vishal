import * as React from "react";
import { useSiteStore } from "@/store/siteStore";
import { fmtNum } from "./lib/format";
import { presetRange, PRESET_DAYS, type RangePreset } from "./lib/range";
import type { AnalyticsRange } from "./api/analytics.api";
import {
  useAnalyticsDevices,
  useAnalyticsOverview,
  useAnalyticsSources,
  useAnalyticsTimeseries,
  useAnalyticsTopPages,
  useAnalyticsWebVitals,
} from "./hooks/useAnalytics";
import { DateRangePicker } from "./components/DateRangePicker";
import { OverviewCards } from "./components/OverviewCards";
import { Panel, PanelState } from "./components/Panel";
import { TrafficChart } from "./components/TrafficChart";
import { SourcesList } from "./components/SourcesList";
import { DevicesDonut } from "./components/DevicesDonut";
import { WebVitalsPanel } from "./components/WebVitalsPanel";
import type { TopPage } from "./api/analytics.api";

/**
 * Analytics dashboard (Phase 2b). Overview cards, a traffic timeseries chart,
 * top pages, traffic sources, device breakdown, and Core Web Vitals — all
 * site-scoped (X-Site-Id) and driven by a shared date-range picker.
 */
export const Analytics: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [preset, setPreset] = React.useState<RangePreset>("28d");
  const [range, setRange] = React.useState<AnalyticsRange>(() =>
    presetRange(PRESET_DAYS["28d"]),
  );

  const onRangeChange = (p: RangePreset, r: AnalyticsRange): void => {
    setPreset(p);
    setRange(r);
  };

  const overview = useAnalyticsOverview(range);
  const timeseries = useAnalyticsTimeseries(range);
  const pages = useAnalyticsTopPages(range);
  const sources = useAnalyticsSources(range);
  const devices = useAnalyticsDevices(range);
  const vitals = useAnalyticsWebVitals(range);

  if (!siteId) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8 text-sm text-muted-foreground">
        Select a site to view analytics.
      </div>
    );
  }

  const tsData = timeseries.data ?? [];
  const pageRows: TopPage[] = pages.data ?? [];
  const sourceRows = sources.data ?? [];
  const deviceRows = devices.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Traffic, engagement, and performance for this website.
          </p>
        </div>
        <DateRangePicker preset={preset} range={range} onChange={onRangeChange} />
      </div>

      <div className="flex flex-col gap-6">
        <OverviewCards
          data={overview.data}
          isLoading={overview.isLoading}
          isError={overview.isError}
        />

        <Panel title="Traffic" subtitle="Visitors and pageviews over time">
          {timeseries.isLoading || timeseries.isError || tsData.length === 0 ? (
            <PanelState
              isLoading={timeseries.isLoading}
              isError={timeseries.isError}
              isEmpty={tsData.length === 0}
              loadingText="Loading traffic…"
              errorText="Could not load traffic data."
              emptyText="No traffic recorded for this range yet."
            />
          ) : (
            <TrafficChart data={tsData} />
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Top pages" subtitle="Most viewed paths">
            {pages.isLoading || pages.isError || pageRows.length === 0 ? (
              <PanelState
                isLoading={pages.isLoading}
                isError={pages.isError}
                isEmpty={pageRows.length === 0}
                loadingText="Loading pages…"
                emptyText="No page views recorded yet."
              />
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Path</th>
                      <th className="px-3 py-2 text-right font-medium">Views</th>
                      <th className="px-3 py-2 text-right font-medium">Visitors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageRows.map((p) => (
                      <tr key={p.path} className="hover:bg-muted/30">
                        <td className="max-w-[16rem] truncate px-3 py-2" title={p.path}>
                          {p.path}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {fmtNum(p.pageviews)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {fmtNum(p.visitors)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Sources" subtitle="Where visitors come from">
            {sources.isLoading || sources.isError || sourceRows.length === 0 ? (
              <PanelState
                isLoading={sources.isLoading}
                isError={sources.isError}
                isEmpty={sourceRows.length === 0}
                loadingText="Loading sources…"
                emptyText="No source data yet."
              />
            ) : (
              <SourcesList data={sourceRows} />
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Devices" subtitle="Visitor device categories">
            {devices.isLoading || devices.isError || deviceRows.length === 0 ? (
              <PanelState
                isLoading={devices.isLoading}
                isError={devices.isError}
                isEmpty={deviceRows.length === 0}
                loadingText="Loading devices…"
                emptyText="No device data yet."
              />
            ) : (
              <DevicesDonut data={deviceRows} />
            )}
          </Panel>

          <Panel title="Core Web Vitals" subtitle="p75 field performance">
            {vitals.isLoading || vitals.isError || !vitals.data ? (
              <PanelState
                isLoading={vitals.isLoading}
                isError={vitals.isError}
                isEmpty={!vitals.data && !vitals.isLoading && !vitals.isError}
                loadingText="Loading web vitals…"
                errorText="Could not load web vitals."
                emptyText="No web-vitals samples yet."
              />
            ) : (
              <WebVitalsPanel data={vitals.data} />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

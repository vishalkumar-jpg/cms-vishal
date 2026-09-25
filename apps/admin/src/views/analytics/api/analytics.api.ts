import { request } from "@/services/AxiosService";

/**
 * Analytics stats API (Phase 2b). All endpoints are header-scoped to the active
 * site (X-Site-Id, injected by AxiosService) — no siteId in the path. `from`/`to`
 * are ISO dates; the server defaults to the last 28 days when omitted.
 */

export interface AnalyticsRange {
  from: string; // ISO date
  to: string; // ISO date
}

// --- /overview --------------------------------------------------------------

export interface AnalyticsOverview {
  visitors: number;
  pageviews: number;
  avgSessionSec: number;
  bounceRate: number; // 0..1 (fraction)
  prev: {
    visitors: number;
    pageviews: number;
  };
}

export const getOverviewRequest = (range: AnalyticsRange): Promise<AnalyticsOverview> =>
  request<AnalyticsOverview>({
    url: "/analytics/overview",
    method: "GET",
    params: { from: range.from, to: range.to },
  });

// --- /timeseries ------------------------------------------------------------

export interface TimeseriesPoint {
  date: string;
  visitors: number;
  pageviews: number;
}

export const getTimeseriesRequest = (
  range: AnalyticsRange,
  interval: "day" = "day",
): Promise<TimeseriesPoint[]> =>
  request<TimeseriesPoint[]>({
    url: "/analytics/timeseries",
    method: "GET",
    params: { from: range.from, to: range.to, interval },
  });

// --- /pages -----------------------------------------------------------------

export interface TopPage {
  path: string;
  pageviews: number;
  visitors: number;
}

export const getTopPagesRequest = (
  range: AnalyticsRange,
  limit = 20,
): Promise<TopPage[]> =>
  request<TopPage[]>({
    url: "/analytics/pages",
    method: "GET",
    params: { from: range.from, to: range.to, limit },
  });

// --- /sources ---------------------------------------------------------------

export interface TrafficSource {
  source: string;
  visitors: number;
}

export const getSourcesRequest = (range: AnalyticsRange): Promise<TrafficSource[]> =>
  request<TrafficSource[]>({
    url: "/analytics/sources",
    method: "GET",
    params: { from: range.from, to: range.to },
  });

// --- /devices ---------------------------------------------------------------

export interface DeviceBreakdown {
  device: string;
  visitors: number;
}

export const getDevicesRequest = (range: AnalyticsRange): Promise<DeviceBreakdown[]> =>
  request<DeviceBreakdown[]>({
    url: "/analytics/devices",
    method: "GET",
    params: { from: range.from, to: range.to },
  });

// --- /web-vitals ------------------------------------------------------------

export interface WebVitalMetric {
  p75: number;
  good: number;
  ni: number;
  poor: number;
}

export interface WebVitals {
  lcp: WebVitalMetric;
  cls: WebVitalMetric;
  inp: WebVitalMetric;
}

export const getWebVitalsRequest = (range: AnalyticsRange): Promise<WebVitals> =>
  request<WebVitals>({
    url: "/analytics/web-vitals",
    method: "GET",
    params: { from: range.from, to: range.to },
  });

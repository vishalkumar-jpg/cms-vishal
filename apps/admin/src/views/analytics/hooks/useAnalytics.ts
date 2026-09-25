import { useQuery } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  getDevicesRequest,
  getOverviewRequest,
  getSourcesRequest,
  getTimeseriesRequest,
  getTopPagesRequest,
  getWebVitalsRequest,
  type AnalyticsOverview,
  type AnalyticsRange,
  type DeviceBreakdown,
  type TimeseriesPoint,
  type TopPage,
  type TrafficSource,
  type WebVitals,
} from "../api/analytics.api";

/**
 * Wrapped analytics hooks. Every query is keyed on
 * `[ANALYTICS, siteId, metric, from, to]` so switching site or range refetches
 * automatically, and gated on an active site (X-Site-Id).
 */

const analyticsKey = (metric: string, range: AnalyticsRange, siteId: string | null) =>
  [ADMIN_QUERY_KEYS.ANALYTICS, siteId, metric, range.from, range.to] as const;

export const useAnalyticsOverview = (range: AnalyticsRange) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<AnalyticsOverview>({
    queryKey: analyticsKey("overview", range, siteId),
    queryFn: () => getOverviewRequest(range),
    enabled: !!siteId,
  });
};

export const useAnalyticsTimeseries = (range: AnalyticsRange) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<TimeseriesPoint[]>({
    queryKey: analyticsKey("timeseries", range, siteId),
    queryFn: () => getTimeseriesRequest(range),
    enabled: !!siteId,
  });
};

export const useAnalyticsTopPages = (range: AnalyticsRange, limit = 20) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<TopPage[]>({
    queryKey: [...analyticsKey("pages", range, siteId), limit] as const,
    queryFn: () => getTopPagesRequest(range, limit),
    enabled: !!siteId,
  });
};

export const useAnalyticsSources = (range: AnalyticsRange) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<TrafficSource[]>({
    queryKey: analyticsKey("sources", range, siteId),
    queryFn: () => getSourcesRequest(range),
    enabled: !!siteId,
  });
};

export const useAnalyticsDevices = (range: AnalyticsRange) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<DeviceBreakdown[]>({
    queryKey: analyticsKey("devices", range, siteId),
    queryFn: () => getDevicesRequest(range),
    enabled: !!siteId,
  });
};

export const useAnalyticsWebVitals = (range: AnalyticsRange) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<WebVitals>({
    queryKey: analyticsKey("web-vitals", range, siteId),
    queryFn: () => getWebVitalsRequest(range),
    enabled: !!siteId,
  });
};

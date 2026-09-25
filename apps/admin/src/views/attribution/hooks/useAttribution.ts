import { useQuery } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import type { AnalyticsRange } from "@/views/analytics/api/analytics.api";
import {
  getAttributionConversionsRequest,
  getAttributionModelsRequest,
  getAttributionOverviewRequest,
  type AttributionModel,
  type AttributionModelsCompare,
  type AttributionOverview,
  type RecentConversion,
} from "../api/attribution.api";

export const useAttributionOverview = (range: AnalyticsRange, model: AttributionModel) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<AttributionOverview>({
    queryKey: [ADMIN_QUERY_KEYS.ATTRIBUTION, siteId, "overview", model, range.from, range.to],
    queryFn: () => getAttributionOverviewRequest(range, model),
    enabled: !!siteId,
  });
};

export const useAttributionModels = (range: AnalyticsRange) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<AttributionModelsCompare>({
    queryKey: [ADMIN_QUERY_KEYS.ATTRIBUTION, siteId, "models", range.from, range.to],
    queryFn: () => getAttributionModelsRequest(range),
    enabled: !!siteId,
  });
};

export const useAttributionConversions = (range: AnalyticsRange) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<RecentConversion[]>({
    queryKey: [ADMIN_QUERY_KEYS.ATTRIBUTION, siteId, "conversions", range.from, range.to],
    queryFn: () => getAttributionConversionsRequest(range),
    enabled: !!siteId,
  });
};

import { request } from "@/services/AxiosService";
import type { AnalyticsRange } from "@/views/analytics/api/analytics.api";

/**
 * Attribution API (Phase 5). Header-scoped to the active site (X-Site-Id). The
 * `model` param selects the attribution model (first | last | linear | position).
 */

export type AttributionModel = "first" | "last" | "linear" | "position";

export interface AttributionBreakdownRow {
  key: string;
  conversions: number;
  value: number;
}

export interface AttributionOverview {
  model: AttributionModel;
  from: string;
  to: string;
  totals: { conversions: number; value: number; touchpoints: number };
  bySource: AttributionBreakdownRow[];
  byCampaign: AttributionBreakdownRow[];
  byLandingPage: AttributionBreakdownRow[];
}

export interface AttributionModelsCompare {
  from: string;
  to: string;
  models: Array<{ model: AttributionModel; bySource: AttributionBreakdownRow[]; totalValue: number }>;
}

export interface RecentConversion {
  id: string;
  ts: string;
  visitorId: string;
  type: string;
  label: string | null;
  value: number;
  landingPath: string | null;
}

export const getAttributionOverviewRequest = (
  range: AnalyticsRange,
  model: AttributionModel,
): Promise<AttributionOverview> =>
  request<AttributionOverview>({
    url: "/attribution/overview",
    method: "GET",
    params: { from: range.from, to: range.to, model },
  });

export const getAttributionModelsRequest = (range: AnalyticsRange): Promise<AttributionModelsCompare> =>
  request<AttributionModelsCompare>({
    url: "/attribution/models",
    method: "GET",
    params: { from: range.from, to: range.to },
  });

export const getAttributionConversionsRequest = (range: AnalyticsRange): Promise<RecentConversion[]> =>
  request<RecentConversion[]>({
    url: "/attribution/conversions",
    method: "GET",
    params: { from: range.from, to: range.to },
  });

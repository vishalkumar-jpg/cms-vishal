import { request } from "@/services/AxiosService";

/** DSAR subject summary — per-table counts + the resolved identity (if any). */
export interface DsarSummary {
  query: string;
  kind: "email" | "visitorId";
  email: string | null;
  visitorIds: string[];
  identity: { id: string; email: string; name: string | null } | null;
  counts: Record<string, number>;
}

/** Full JSON export — every held row across all tables. */
export interface DsarExport extends DsarSummary {
  data: Record<string, unknown[]>;
}

/** Erasure result — rows removed/anonymized per table. */
export interface DsarErasure {
  query: string;
  email: string | null;
  visitorIds: string[];
  deleted: Record<string, number>;
}

/** A proof-of-consent record (recent-list). */
export interface ConsentRecord {
  id: string;
  ts: string;
  visitorId: string | null;
  analytics: boolean;
  marketing: boolean;
  policyVersion: string | null;
  method: string;
}

/**
 * DSAR API — site-scoped (X-Site-Id header auto-injected by AxiosService), so no
 * `:siteId` in the path. All routes are site_admin on the API.
 */
export const dsarSummaryRequest = (query: string): Promise<DsarSummary> =>
  request<DsarSummary>({ url: "/privacy/subject", method: "GET", params: { query } });

export const dsarExportRequest = (query: string): Promise<DsarExport> =>
  request<DsarExport>({ url: "/privacy/subject/export", method: "GET", params: { query } });

export const dsarEraseRequest = (query: string): Promise<DsarErasure> =>
  request<DsarErasure>({ url: "/privacy/subject", method: "DELETE", params: { query } });

/** Recent proof-of-consent records for the active site (consent config route). */
export const consentRecordsRequest = (siteId: string, limit = 50): Promise<ConsentRecord[]> =>
  request<ConsentRecord[]>({
    url: `/sites/${siteId}/consent/records`,
    method: "GET",
    params: { limit },
  });

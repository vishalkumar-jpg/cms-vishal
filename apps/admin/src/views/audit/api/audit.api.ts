import { request } from "@/services/AxiosService";

/**
 * Audit-log API. The audit controller is mounted under `/sites/:siteId/audit`
 * (path-scoped, like members), so the active site id is embedded in the URL.
 * Read-only.
 */

export interface AuditEvent {
  id: string;
  siteId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  category: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditPage {
  rows: AuditEvent[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface AuditQuery {
  action?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

export const listAuditRequest = (siteId: string, query: AuditQuery = {}): Promise<AuditPage> =>
  request<AuditPage>({
    url: `/sites/${siteId}/audit`,
    method: "GET",
    params: {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    },
  });

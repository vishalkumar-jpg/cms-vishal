import { useInfiniteQuery } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { listAuditRequest, type AuditPage } from "../api/audit.api";

const PAGE_SIZE = 50;

export interface AuditFilters {
  action?: string;
  entityType?: string;
}

/** Load-more audit listing (infinite query). All audit access goes through this. */
export const useAudit = (filters: AuditFilters) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useInfiniteQuery<AuditPage>({
    queryKey: [ADMIN_QUERY_KEYS.AUDIT, siteId, filters.action ?? "", filters.entityType ?? ""],
    enabled: !!siteId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listAuditRequest(siteId as string, {
        action: filters.action,
        entityType: filters.entityType,
        limit: PAGE_SIZE,
        offset: pageParam as number,
      }),
    getNextPageParam: (last) => (last.hasMore ? last.offset + last.limit : undefined),
  });
};

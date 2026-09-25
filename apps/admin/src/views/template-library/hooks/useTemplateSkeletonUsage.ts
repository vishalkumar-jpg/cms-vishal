import { useQuery } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  getTemplateSkeletonUsageRequest,
  getTopTemplateUsageRequest,
  type TemplateSkeletonUsage,
  type TopTemplateUsageEntry,
} from "@/views/template-catalog/api/template-skeletons.api";

/** Site-scoped usage analytics for one starter skeleton. */
export const useTemplateSkeletonUsage = (skeletonId: string | null, enabled: boolean) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<TemplateSkeletonUsage>({
    queryKey: [ADMIN_QUERY_KEYS.TEMPLATE_SKELETON, siteId, "usage", skeletonId] as const,
    queryFn: () => getTemplateSkeletonUsageRequest(skeletonId!),
    enabled: enabled && !!siteId && !!skeletonId,
    staleTime: 60_000,
  });
};

/** Top starter templates by page count on the active site. */
export const useTopTemplateUsage = (enabled: boolean, limit = 100) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<TopTemplateUsageEntry[]>({
    queryKey: [ADMIN_QUERY_KEYS.TEMPLATE_SKELETON, siteId, "usage-top", limit] as const,
    queryFn: () => getTopTemplateUsageRequest(limit),
    enabled: enabled && !!siteId,
    staleTime: 60_000,
  });
};

/** Map templateKey → usage totals for card metadata. */
export function usageCountByTemplateKey(
  entries: TopTemplateUsageEntry[] | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries ?? []) {
    map.set(entry.templateKey, entry.totalPages);
  }
  return map;
}

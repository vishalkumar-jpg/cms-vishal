import { useQuery } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  getTemplateSkeletonHistoryVersionRequest,
  listTemplateSkeletonHistoryRequest,
  type TemplateSkeletonVersionDetail,
  type TemplateSkeletonVersionSummary,
} from "@/views/template-catalog/api/template-skeletons.api";

const ONE_SECOND_MS = 1000;
const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
const FIVE_MINUTES_MS = 5 * ONE_MINUTE_MS;

/** Stale window for the version list query (summaries change infrequently). */
const TEMPLATE_HISTORY_LIST_STALE_TIME_MS = ONE_MINUTE_MS;

/** Stale window for a selected historical version snapshot (layout preview). */
const TEMPLATE_HISTORY_VERSION_QUERY_STALE_TIME_MS = FIVE_MINUTES_MS;

const historyQueryKey = (siteId: string | null, skeletonId: string | null) =>
  [ADMIN_QUERY_KEYS.TEMPLATE_SKELETON, siteId, "history", skeletonId] as const;

const versionQueryKey = (
  siteId: string | null,
  skeletonId: string | null,
  version: string | null,
) => [ADMIN_QUERY_KEYS.TEMPLATE_SKELETON, siteId, "history", skeletonId, version] as const;

/** Version summaries for a starter skeleton (newest first). */
export const useTemplateSkeletonHistory = (skeletonId: string | null, enabled: boolean) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<TemplateSkeletonVersionSummary[]>({
    queryKey: historyQueryKey(siteId, skeletonId),
    queryFn: () => listTemplateSkeletonHistoryRequest(skeletonId!),
    enabled: enabled && !!siteId && !!skeletonId,
    staleTime: TEMPLATE_HISTORY_LIST_STALE_TIME_MS,
  });
};

/** Full snapshot for a selected historical version (layout for read-only preview). */
export const useTemplateSkeletonHistoryVersion = (
  skeletonId: string | null,
  version: string | null,
  enabled: boolean,
) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<TemplateSkeletonVersionDetail>({
    queryKey: versionQueryKey(siteId, skeletonId, version),
    queryFn: () => getTemplateSkeletonHistoryVersionRequest(skeletonId!, version!),
    enabled: enabled && !!siteId && !!skeletonId && !!version,
    staleTime: TEMPLATE_HISTORY_VERSION_QUERY_STALE_TIME_MS,
  });
};

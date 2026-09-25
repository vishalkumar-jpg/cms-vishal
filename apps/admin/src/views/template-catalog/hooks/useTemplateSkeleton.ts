import { useQuery } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  getTemplateSkeletonByIdRequest,
  getTemplateSkeletonByKeyRequest,
} from "../api/template-skeletons.api";
import type { TemplateSkeletonRecord } from "../types-skeleton";

const skeletonQueryOptions = (
  siteId: string | null,
  key: readonly [string, string | null],
  fetcher: () => Promise<TemplateSkeletonRecord>,
  enabled: boolean,
) => ({
  queryKey: [ADMIN_QUERY_KEYS.TEMPLATE_SKELETON, siteId, ...key] as const,
  queryFn: fetcher,
  enabled: enabled && !!siteId,
  staleTime: 5 * 60 * 1000,
});

/** Lazy-load starter layout JSON when a preview dialog opens. */
export const useTemplateSkeletonByKey = (templateKey: string | null, enabled: boolean) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery(
    skeletonQueryOptions(
      siteId,
      ["by-key", templateKey],
      () => getTemplateSkeletonByKeyRequest(templateKey!),
      enabled && !!templateKey,
    ),
  );
};

/** Lazy-load starter layout JSON by catalog id. */
export const useTemplateSkeletonById = (id: string | null, enabled: boolean) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery(
    skeletonQueryOptions(
      siteId,
      ["id", id],
      () => getTemplateSkeletonByIdRequest(id!),
      enabled && !!id,
    ),
  );
};

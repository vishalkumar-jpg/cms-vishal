import { useQuery } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { listTemplateCatalogRequest } from "../api/template-catalog.api";
import type { TemplateCatalogEntry, TemplateCatalogQuery } from "../types";

/** List platform template catalog entries for the active site context. */
export const useTemplateCatalog = (query?: TemplateCatalogQuery) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<TemplateCatalogEntry[]>({
    queryKey: [ADMIN_QUERY_KEYS.TEMPLATE_CATALOG, siteId, query ?? {}],
    queryFn: () => listTemplateCatalogRequest(query),
    enabled: !!siteId,
  });
};

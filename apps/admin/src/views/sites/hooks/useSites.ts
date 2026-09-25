import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, type Site } from "@ob-cms/shared";
import { useSiteStore } from "@/store/siteStore";
import { useAuthStore } from "@/store/authStore";
import {
  createSiteRequest,
  listSitesRequest,
  type CreateSitePayload,
} from "../api/sites.api";

/** Wrapped hook: the accessible sites for the current user. */
export const useSites = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Site[]>({
    queryKey: [QUERY_KEYS.SITES],
    queryFn: () => listSitesRequest(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Sites list + the active-site selection. Auto-selects the first site if none
 * is selected yet (or the persisted one is no longer accessible).
 */
export const useActiveSite = () => {
  const { data: sites = [], isLoading } = useSites();
  const activeSiteId = useSiteStore((s) => s.activeSiteId);
  const setActiveSiteId = useSiteStore((s) => s.setActiveSiteId);

  useEffect(() => {
    if (isLoading || sites.length === 0) return;
    const stillValid = activeSiteId && sites.some((s) => s.id === activeSiteId);
    if (!stillValid) setActiveSiteId(sites[0].id);
  }, [sites, activeSiteId, isLoading, setActiveSiteId]);

  const activeSite = sites.find((s) => s.id === activeSiteId) ?? null;
  return { sites, activeSite, activeSiteId, setActiveSiteId, isLoading };
};

/** Create a website, refresh the sites list, and select the new site. */
export const useCreateSite = () => {
  const qc = useQueryClient();
  const setActiveSiteId = useSiteStore((s) => s.setActiveSiteId);
  const { sites } = useActiveSite();
  return useMutation<Site, unknown, CreateSitePayload>({
    mutationFn: (payload: CreateSitePayload) => {
      const orgId =
        payload.orgId ??
        (sites[0] as Site & { orgId?: string })?.orgId ??
        sites[0]?.tenantId;
      return createSiteRequest(orgId ? { ...payload, orgId } : payload);
    },
    onSuccess: (site) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SITES] });
      if (site?.id) setActiveSiteId(site.id);
    },
  });
};

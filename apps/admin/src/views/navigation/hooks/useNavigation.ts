import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Axios from "axios";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { getNavigationRequest, upsertNavigationRequest } from "../api/navigation.api";
import type { Navigation, UpsertNavigationPayload } from "../types";

/**
 * Wrapped navigation hooks. A missing menu (404) is a normal, expected state,
 * so we disable retries and resolve to `null` instead of erroring.
 */
export const useNavigation = (location: string) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Navigation | null>({
    queryKey: [ADMIN_QUERY_KEYS.NAVIGATION, siteId, location],
    queryFn: async () => {
      try {
        return await getNavigationRequest(location);
      } catch (err: unknown) {
        if (Axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: !!siteId,
    retry: false,
  });
};

export const useUpsertNavigation = (location: string) => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Navigation, unknown, UpsertNavigationPayload>({
    mutationFn: (payload: UpsertNavigationPayload) =>
      upsertNavigationRequest(location, payload),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: [ADMIN_QUERY_KEYS.NAVIGATION, siteId, location],
      }),
  });
};

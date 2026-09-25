import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { getThemeRequest, updateThemeRequest } from "../api/theme.api";
import type { Theme, UpdateThemePayload } from "../types";

/** The active site's theme (auto-created by the API on first read). */
export const useTheme = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Theme>({
    queryKey: [ADMIN_QUERY_KEYS.THEME, siteId],
    queryFn: () => getThemeRequest(),
    enabled: !!siteId,
  });
};

/** PATCH the theme and refresh the cached theme for the active site. */
export const useUpdateTheme = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Theme, unknown, UpdateThemePayload>({
    mutationFn: (payload: UpdateThemePayload) => updateThemeRequest(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.THEME, siteId] }),
  });
};

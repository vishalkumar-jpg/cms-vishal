import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SerializedLayout } from "@ob-cms/block-schema";
import {
  getSiteChromeRequest,
  saveSiteChromeRequest,
  type ChromeSlot,
  type SiteChrome,
} from "../api/globals.api";

const CHROME_KEY = "site-chrome";

/** Read the active site's global header + footer layouts. */
export const useSiteChrome = (siteId: string | null) =>
  useQuery<SiteChrome>({
    queryKey: [CHROME_KEY, siteId],
    queryFn: getSiteChromeRequest,
    enabled: !!siteId,
  });

/** Save one chrome slot (header or footer). MVP: save = live. */
export const useSaveSiteChrome = (siteId: string | null, slot: ChromeSlot) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: SerializedLayout) => saveSiteChromeRequest(slot, layout),
    onSuccess: (chrome) => qc.setQueryData([CHROME_KEY, siteId], chrome),
  });
};

import { useQuery } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { searchRequest, type SearchHit } from "../api/search.api";

/** Minimum query length before we hit the API (avoids noisy 1-char searches). */
const MIN_QUERY_LENGTH = 2;

/**
 * Global content search hook. Keyed on `[SEARCH, siteId, q]` so results are
 * per-site and per-term cached. Disabled for empty/short queries (the palette
 * shows navigation commands instead). Callers should pass an already-debounced
 * term to keep request volume low.
 */
export const useSearch = (q: string) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const term = q.trim();
  return useQuery<SearchHit[]>({
    queryKey: [ADMIN_QUERY_KEYS.SEARCH, siteId, term],
    queryFn: () => searchRequest(term),
    enabled: !!siteId && term.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  });
};

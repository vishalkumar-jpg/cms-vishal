import { request } from "@/services/AxiosService";

/** Mirrors the API `SearchType` discriminator (search.service.ts). */
export type SearchType = "page" | "post" | "media" | "collection" | "collectionItem" | "form";

/** A unified search hit returned by `GET /api/search`. `url` is an admin deep-link. */
export interface SearchHit {
  type: SearchType;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

/**
 * Global content search for the active site. The X-Site-Id header is injected
 * automatically by the Axios request interceptor, so results are site-scoped.
 */
export const searchRequest = (q: string): Promise<SearchHit[]> =>
  request<SearchHit[]>({ url: `/search`, method: "GET", params: { q } });

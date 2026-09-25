import { request } from "@/services/AxiosService";
import type { TemplateCatalogEntry, TemplateCatalogQuery } from "../types";

/**
 * Raw template-catalog API calls. Platform-global browse projection; site
 * membership is supplied via the X-Site-Id header (Axios mutator).
 */
export const listTemplateCatalogRequest = (
  query?: TemplateCatalogQuery,
): Promise<TemplateCatalogEntry[]> =>
  request<TemplateCatalogEntry[]>({
    url: "/template-catalog",
    method: "GET",
    params: query,
  });

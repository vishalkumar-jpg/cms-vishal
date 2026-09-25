import { request } from "@/services/AxiosService";
import type { SerializedLayout } from "@ob-cms/block-schema";

/**
 * GLOBAL-CHROME API — the active site's ONE global header + footer. Site-scoped
 * via the `X-Site-Id` header (added by the Axios mutator from the active site),
 * so the path is just `/site-chrome`; the controller resolves the tenant from
 * the header. `GET` reads both slots; `PUT` saves header and/or footer (MVP:
 * save = live; the API purges the site's render cache).
 */
export interface SiteChrome {
  header: SerializedLayout | null;
  footer: SerializedLayout | null;
}

export type ChromeSlot = "header" | "footer";

export const getSiteChromeRequest = (): Promise<SiteChrome> =>
  request<SiteChrome>({ url: "/site-chrome", method: "GET" });

/** Save one slot. The other is left untouched (omitted from the body). */
export const saveSiteChromeRequest = (
  slot: ChromeSlot,
  layout: SerializedLayout,
): Promise<SiteChrome> =>
  request<SiteChrome>({ url: "/site-chrome", method: "PUT", data: { [slot]: layout } });

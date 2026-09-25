import type { Site } from "@ob-cms/shared";
import { request } from "@/services/AxiosService";

/**
 * Raw sites API calls. `GET /api/sites` returns the sites the current user can
 * access (envelope unwrapped to the inner array).
 */
export const listSitesRequest = (): Promise<Site[]> =>
  request<Site[]>({ url: "/sites", method: "GET" });

export const getSiteRequest = (siteId: string): Promise<Site> =>
  request<Site>({ url: `/sites/${siteId}`, method: "GET" });

/**
 * Create a website. Mirrors the API `CreateSiteDto` (name, slug, subdomain,
 * orgId?). `orgId` is optional: the wizard sends it when it could load the org
 * list; when omitted the API auto-resolves (the caller's org from their
 * memberships, else the platform's only active org) and 400s with a clear
 * message if the choice is ambiguous.
 */
export interface CreateSitePayload {
  name: string;
  slug: string;
  subdomain: string;
  orgId?: string;
}

export const createSiteRequest = (payload: CreateSitePayload): Promise<Site> =>
  request<Site>({ url: "/sites", method: "POST", data: payload });

export interface UpdateSitePayload {
  name?: string;
  status?: "active" | "suspended";
}

export const updateSiteRequest = (
  siteId: string,
  payload: UpdateSitePayload,
): Promise<Site> =>
  request<Site>({ url: `/sites/${siteId}`, method: "PATCH", data: payload });

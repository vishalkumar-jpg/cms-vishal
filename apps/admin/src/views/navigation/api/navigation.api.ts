import { request } from "@/services/AxiosService";
import type { Navigation, UpsertNavigationPayload } from "../types";

/**
 * Raw navigation API calls. Site-scoped via the X-Site-Id header (Axios
 * mutator), so paths are relative. IMPORTANT: `location` is a PATH PARAM.
 */

/**
 * Fetch the navigation row for a location. May 404 when the menu is unset —
 * the caller is responsible for catching the axios error.
 */
export const getNavigationRequest = (location: string): Promise<Navigation> =>
  request<Navigation>({ url: `/navigation/${location}`, method: "GET" });

/** Upsert the navigation tree for a location. Body has ONLY `tree`. */
export const upsertNavigationRequest = (
  location: string,
  payload: UpsertNavigationPayload,
): Promise<Navigation> =>
  request<Navigation>({ url: `/navigation/${location}`, method: "PUT", data: payload });

import { request } from "@/services/AxiosService";
import type { Theme, UpdateThemePayload } from "../types";

/**
 * Raw theme API calls. Site-scoped via the X-Site-Id header (Axios mutator),
 * so paths are relative: `/theme`, never `/sites/:id/theme`. The mutator
 * unwraps the `{ data }` envelope, so `request<T>` resolves to the inner payload.
 */
export const getThemeRequest = (): Promise<Theme> =>
  request<Theme>({ url: `/theme`, method: "GET" });

export const updateThemeRequest = (payload: UpdateThemePayload): Promise<Theme> =>
  request<Theme>({ url: `/theme`, method: "PATCH", data: payload });

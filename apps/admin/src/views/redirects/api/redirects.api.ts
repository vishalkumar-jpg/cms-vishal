import { request } from "@/services/AxiosService";
import type {
  CreateRedirectPayload,
  ImportRedirectsResult,
  Redirect,
  UpdateRedirectPayload,
} from "../types";

/**
 * Raw redirect API calls. Site-scoped via the X-Site-Id header (Axios mutator),
 * so paths are relative: `/redirects`, never `/sites/:id/redirects`.
 */
export const listRedirectsRequest = (): Promise<Redirect[]> =>
  request<Redirect[]>({ url: `/redirects`, method: "GET" });

export const createRedirectRequest = (
  payload: CreateRedirectPayload,
): Promise<Redirect> =>
  request<Redirect>({ url: `/redirects`, method: "POST", data: payload });

export const updateRedirectRequest = (
  id: string,
  payload: UpdateRedirectPayload,
): Promise<Redirect> =>
  request<Redirect>({ url: `/redirects/${id}`, method: "PATCH", data: payload });

export const deleteRedirectRequest = (id: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `/redirects/${id}`, method: "DELETE" });

export const importRedirectsRequest = (
  csv: string,
): Promise<ImportRedirectsResult> =>
  request<ImportRedirectsResult>({
    url: `/redirects/import`,
    method: "POST",
    data: { csv },
  });

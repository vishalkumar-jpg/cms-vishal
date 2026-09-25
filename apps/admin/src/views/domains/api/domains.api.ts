import { request } from "@/services/AxiosService";
import type {
  CreateDomainPayload,
  CreateDomainResult,
  Domain,
  SslCheckResult,
  VerifyResult,
} from "../types";

/**
 * Raw domain API calls. Site-scoped via the X-Site-Id header (Axios mutator),
 * so paths are relative: `/domains`, never `/sites/:id/domains`.
 */
export const listDomainsRequest = (): Promise<Domain[]> =>
  request<Domain[]>({ url: `/domains`, method: "GET" });

export const createDomainRequest = (
  payload: CreateDomainPayload,
): Promise<CreateDomainResult> =>
  request<CreateDomainResult>({ url: `/domains`, method: "POST", data: payload });

export const verifyDomainRequest = (id: string): Promise<VerifyResult> =>
  request<VerifyResult>({ url: `/domains/${id}/verify`, method: "POST" });

export const setPrimaryDomainRequest = (id: string): Promise<Domain> =>
  request<Domain>({ url: `/domains/${id}/primary`, method: "POST" });

export const deleteDomainRequest = (id: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `/domains/${id}`, method: "DELETE" });

export const sslCheckDomainRequest = (id: string): Promise<SslCheckResult> =>
  request<SslCheckResult>({ url: `/domains/${id}/ssl-check`, method: "POST" });

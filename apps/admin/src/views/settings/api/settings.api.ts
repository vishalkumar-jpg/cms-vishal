import { request } from "@/services/AxiosService";
import type {
  CachePurgePayload,
  CachePurgeResult,
  CdnConfig,
  ConsentConfig,
  RetentionConfig,
  SiteIntegrations,
  SiteLocales,
} from "../types";

// -- i18n / localization (B13) ------------------------------------------------

export const getLocalesRequest = (siteId: string): Promise<SiteLocales> =>
  request<SiteLocales>({ url: `/sites/${siteId}/locales`, method: "GET" });

export const updateLocalesRequest = (
  siteId: string,
  payload: SiteLocales,
): Promise<SiteLocales> =>
  request<SiteLocales>({ url: `/sites/${siteId}/locales`, method: "PUT", data: payload });

/**
 * Site Settings hub API calls (#32 integrations + #31 CDN). These routes carry
 * `:siteId` in the path (mirroring `/sites/:siteId/settings`); the Axios mutator
 * also sends X-Site-Id and unwraps the `{ data }` envelope.
 */

export const getIntegrationsRequest = (siteId: string): Promise<SiteIntegrations> =>
  request<SiteIntegrations>({ url: `/sites/${siteId}/integrations`, method: "GET" });

export const updateIntegrationsRequest = (
  siteId: string,
  payload: SiteIntegrations,
): Promise<SiteIntegrations> =>
  request<SiteIntegrations>({
    url: `/sites/${siteId}/integrations`,
    method: "PUT",
    data: payload,
  });

export const getCdnRequest = (siteId: string): Promise<CdnConfig> =>
  request<CdnConfig>({ url: `/sites/${siteId}/cdn`, method: "GET" });

export const updateCdnRequest = (siteId: string, payload: CdnConfig): Promise<CdnConfig> =>
  request<CdnConfig>({ url: `/sites/${siteId}/cdn`, method: "PUT", data: payload });

export const purgeCacheRequest = (
  siteId: string,
  payload: CachePurgePayload,
): Promise<CachePurgeResult> =>
  request<CachePurgeResult>({
    url: `/sites/${siteId}/cache/purge`,
    method: "POST",
    data: payload,
  });

// -- Privacy & Consent (banner config + retention windows) --------------------

export const getConsentRequest = (siteId: string): Promise<ConsentConfig> =>
  request<ConsentConfig>({ url: `/sites/${siteId}/consent`, method: "GET" });

export const updateConsentRequest = (
  siteId: string,
  payload: ConsentConfig,
): Promise<ConsentConfig> =>
  request<ConsentConfig>({ url: `/sites/${siteId}/consent`, method: "PUT", data: payload });

export const getRetentionRequest = (siteId: string): Promise<RetentionConfig> =>
  request<RetentionConfig>({ url: `/sites/${siteId}/retention`, method: "GET" });

export const updateRetentionRequest = (
  siteId: string,
  payload: RetentionConfig,
): Promise<RetentionConfig> =>
  request<RetentionConfig>({ url: `/sites/${siteId}/retention`, method: "PUT", data: payload });

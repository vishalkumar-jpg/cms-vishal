import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  getCdnRequest,
  getConsentRequest,
  getIntegrationsRequest,
  getLocalesRequest,
  getRetentionRequest,
  purgeCacheRequest,
  updateCdnRequest,
  updateConsentRequest,
  updateIntegrationsRequest,
  updateLocalesRequest,
  updateRetentionRequest,
} from "../api/settings.api";
import type {
  CachePurgePayload,
  CachePurgeResult,
  CdnConfig,
  ConsentConfig,
  RetentionConfig,
  SiteIntegrations,
  SiteLocales,
} from "../types";

/** Wrapped Site Settings hub hooks — all server access goes through these. */

// -- i18n / localization (B13) ------------------------------------------------

/** The active site's locale set. Always resolves (defaults to single-locale). */
export const useLocales = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<SiteLocales>({
    queryKey: [ADMIN_QUERY_KEYS.SETTINGS_LOCALES, siteId],
    queryFn: () => getLocalesRequest(siteId as string),
    enabled: !!siteId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateLocales = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<SiteLocales, unknown, SiteLocales>({
    mutationFn: (payload) => updateLocalesRequest(siteId as string, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.SETTINGS_LOCALES, siteId] }),
  });
};

export const useIntegrations = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<SiteIntegrations>({
    queryKey: [ADMIN_QUERY_KEYS.SETTINGS_INTEGRATIONS, siteId],
    queryFn: () => getIntegrationsRequest(siteId as string),
    enabled: !!siteId,
  });
};

export const useUpdateIntegrations = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<SiteIntegrations, unknown, SiteIntegrations>({
    mutationFn: (payload) => updateIntegrationsRequest(siteId as string, payload),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: [ADMIN_QUERY_KEYS.SETTINGS_INTEGRATIONS, siteId],
      }),
  });
};

export const useCdn = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<CdnConfig>({
    queryKey: [ADMIN_QUERY_KEYS.SETTINGS_CDN, siteId],
    queryFn: () => getCdnRequest(siteId as string),
    enabled: !!siteId,
  });
};

export const useUpdateCdn = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<CdnConfig, unknown, CdnConfig>({
    mutationFn: (payload) => updateCdnRequest(siteId as string, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.SETTINGS_CDN, siteId] }),
  });
};

export const usePurgeCache = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<CachePurgeResult, unknown, CachePurgePayload>({
    mutationFn: (payload) => purgeCacheRequest(siteId as string, payload),
  });
};

// -- Privacy & Consent --------------------------------------------------------

export const useConsentConfig = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<ConsentConfig>({
    queryKey: [ADMIN_QUERY_KEYS.SETTINGS_CONSENT, siteId],
    queryFn: () => getConsentRequest(siteId as string),
    enabled: !!siteId,
  });
};

export const useUpdateConsentConfig = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<ConsentConfig, unknown, ConsentConfig>({
    mutationFn: (payload) => updateConsentRequest(siteId as string, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.SETTINGS_CONSENT, siteId] }),
  });
};

export const useRetentionConfig = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<RetentionConfig>({
    queryKey: [ADMIN_QUERY_KEYS.SETTINGS_RETENTION, siteId],
    queryFn: () => getRetentionRequest(siteId as string),
    enabled: !!siteId,
  });
};

export const useUpdateRetentionConfig = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<RetentionConfig, unknown, RetentionConfig>({
    mutationFn: (payload) => updateRetentionRequest(siteId as string, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.SETTINGS_RETENTION, siteId] }),
  });
};

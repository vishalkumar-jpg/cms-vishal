import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  createDomainRequest,
  deleteDomainRequest,
  listDomainsRequest,
  setPrimaryDomainRequest,
  sslCheckDomainRequest,
  verifyDomainRequest,
} from "../api/domains.api";
import type {
  CreateDomainPayload,
  CreateDomainResult,
  Domain,
  SslCheckResult,
  VerifyResult,
} from "../types";

/** Wrapped domain hooks. All domain server access goes through these. */

export const useDomains = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Domain[]>({
    queryKey: [ADMIN_QUERY_KEYS.DOMAINS, siteId],
    queryFn: () => listDomainsRequest(),
    enabled: !!siteId,
  });
};

export const useCreateDomain = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<CreateDomainResult, unknown, CreateDomainPayload>({
    mutationFn: (payload) => createDomainRequest(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.DOMAINS, siteId] }),
  });
};

export const useVerifyDomain = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<VerifyResult, unknown, string>({
    mutationFn: (id) => verifyDomainRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.DOMAINS, siteId] }),
  });
};

export const useSetPrimaryDomain = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Domain, unknown, string>({
    mutationFn: (id) => setPrimaryDomainRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.DOMAINS, siteId] }),
  });
};

export const useDeleteDomain = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: boolean }, unknown, string>({
    mutationFn: (id) => deleteDomainRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.DOMAINS, siteId] }),
  });
};

/** SITE-HEALTH — trigger an on-demand SSL/cert-expiry re-check for a domain. */
export const useSslCheckDomain = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<SslCheckResult, unknown, string>({
    mutationFn: (id) => sslCheckDomainRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.DOMAINS, siteId] }),
  });
};

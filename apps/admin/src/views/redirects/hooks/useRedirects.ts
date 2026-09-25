import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  createRedirectRequest,
  deleteRedirectRequest,
  importRedirectsRequest,
  listRedirectsRequest,
  updateRedirectRequest,
} from "../api/redirects.api";
import type {
  CreateRedirectPayload,
  ImportRedirectsResult,
  Redirect,
  UpdateRedirectPayload,
} from "../types";

/** Wrapped redirect hooks. All redirect server access goes through these. */

export const useRedirects = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Redirect[]>({
    queryKey: [ADMIN_QUERY_KEYS.REDIRECTS, siteId],
    queryFn: () => listRedirectsRequest(),
    enabled: !!siteId,
  });
};

export const useCreateRedirect = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Redirect, unknown, CreateRedirectPayload>({
    mutationFn: (payload) => createRedirectRequest(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.REDIRECTS, siteId] }),
  });
};

export const useUpdateRedirect = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<
    Redirect,
    unknown,
    { id: string; payload: UpdateRedirectPayload }
  >({
    mutationFn: ({ id, payload }) => updateRedirectRequest(id, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.REDIRECTS, siteId] }),
  });
};

export const useDeleteRedirect = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: boolean }, unknown, string>({
    mutationFn: (id) => deleteRedirectRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.REDIRECTS, siteId] }),
  });
};

export const useImportRedirects = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<ImportRedirectsResult, unknown, { csv: string }>({
    mutationFn: ({ csv }) => importRedirectsRequest(csv),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.REDIRECTS, siteId] }),
  });
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  createApiKeyRequest,
  createWebhookRequest,
  deleteWebhookRequest,
  listApiKeysRequest,
  listWebhookDeliveriesRequest,
  listWebhooksRequest,
  revokeApiKeyRequest,
  sendTestWebhookRequest,
  updateWebhookRequest,
} from "../api/developers.api";
import type {
  ApiKey,
  CreateApiKeyPayload,
  CreatedApiKey,
  CreatedWebhook,
  CreateWebhookPayload,
  SendTestResult,
  UpdateWebhookPayload,
  Webhook,
  WebhookDelivery,
} from "../types";

/** Wrapped Developers hooks. All API-key/webhook server access goes through these. */

// --- API keys ---------------------------------------------------------------

export const useApiKeys = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<ApiKey[]>({
    queryKey: [ADMIN_QUERY_KEYS.API_KEYS, siteId],
    queryFn: () => listApiKeysRequest(),
    enabled: !!siteId,
  });
};

export const useCreateApiKey = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<CreatedApiKey, unknown, CreateApiKeyPayload>({
    mutationFn: (payload) => createApiKeyRequest(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.API_KEYS, siteId] }),
  });
};

export const useRevokeApiKey = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<ApiKey, unknown, string>({
    mutationFn: (id) => revokeApiKeyRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.API_KEYS, siteId] }),
  });
};

// --- webhooks ---------------------------------------------------------------

export const useWebhooks = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Webhook[]>({
    queryKey: [ADMIN_QUERY_KEYS.WEBHOOKS, siteId],
    queryFn: () => listWebhooksRequest(),
    enabled: !!siteId,
  });
};

export const useCreateWebhook = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<CreatedWebhook, unknown, CreateWebhookPayload>({
    mutationFn: (payload) => createWebhookRequest(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.WEBHOOKS, siteId] }),
  });
};

export const useUpdateWebhook = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Webhook, unknown, { id: string; payload: UpdateWebhookPayload }>({
    mutationFn: ({ id, payload }) => updateWebhookRequest(id, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.WEBHOOKS, siteId] }),
  });
};

export const useDeleteWebhook = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: boolean }, unknown, string>({
    mutationFn: (id) => deleteWebhookRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.WEBHOOKS, siteId] }),
  });
};

export const useSendTestWebhook = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<SendTestResult, unknown, string>({
    mutationFn: (id) => sendTestWebhookRequest(id),
    onSuccess: (_data, id) =>
      qc.invalidateQueries({
        queryKey: [ADMIN_QUERY_KEYS.WEBHOOK_DELIVERIES, siteId, id],
      }),
  });
};

export const useWebhookDeliveries = (id: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<WebhookDelivery[]>({
    queryKey: [ADMIN_QUERY_KEYS.WEBHOOK_DELIVERIES, siteId, id],
    queryFn: () => listWebhookDeliveriesRequest(id as string),
    enabled: !!siteId && !!id,
  });
};

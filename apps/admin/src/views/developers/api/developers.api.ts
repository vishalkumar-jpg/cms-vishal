import { request } from "@/services/AxiosService";
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

/**
 * Raw Developers API calls. Site-scoped via the X-Site-Id header (Axios
 * mutator), so paths are relative: `/api-keys`, `/webhooks`.
 */

// --- API keys ---------------------------------------------------------------

export const listApiKeysRequest = (): Promise<ApiKey[]> =>
  request<ApiKey[]>({ url: `/api-keys`, method: "GET" });

export const createApiKeyRequest = (payload: CreateApiKeyPayload): Promise<CreatedApiKey> =>
  request<CreatedApiKey>({ url: `/api-keys`, method: "POST", data: payload });

export const revokeApiKeyRequest = (id: string): Promise<ApiKey> =>
  request<ApiKey>({ url: `/api-keys/${id}`, method: "DELETE" });

// --- webhooks ---------------------------------------------------------------

export const listWebhooksRequest = (): Promise<Webhook[]> =>
  request<Webhook[]>({ url: `/webhooks`, method: "GET" });

export const createWebhookRequest = (payload: CreateWebhookPayload): Promise<CreatedWebhook> =>
  request<CreatedWebhook>({ url: `/webhooks`, method: "POST", data: payload });

export const updateWebhookRequest = (
  id: string,
  payload: UpdateWebhookPayload,
): Promise<Webhook> =>
  request<Webhook>({ url: `/webhooks/${id}`, method: "PATCH", data: payload });

export const deleteWebhookRequest = (id: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `/webhooks/${id}`, method: "DELETE" });

export const sendTestWebhookRequest = (id: string): Promise<SendTestResult> =>
  request<SendTestResult>({ url: `/webhooks/${id}/test`, method: "POST" });

export const listWebhookDeliveriesRequest = (id: string): Promise<WebhookDelivery[]> =>
  request<WebhookDelivery[]>({ url: `/webhooks/${id}/deliveries`, method: "GET" });

/**
 * Developers (API & Webhooks) shapes — mirror the API tables/DTOs (E27).
 * Site-scoped via the X-Site-Id header (Axios mutator), so paths are relative.
 */

export interface ApiKey {
  id: string;
  siteId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Create response — `plaintext` is present ONLY here (shown once). */
export interface CreatedApiKey extends ApiKey {
  plaintext: string;
}

export interface CreateApiKeyPayload {
  name: string;
}

/** The events a subscription may listen for. */
export const WEBHOOK_EVENTS = [
  "page.published",
  "post.published",
  "form.submitted",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: string;
  siteId: string;
  url: string;
  events: string[];
  active: boolean;
  hasSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Create response — `secret` is present ONLY here (shown once). */
export interface CreatedWebhook extends Webhook {
  secret: string;
}

export interface CreateWebhookPayload {
  url: string;
  events: string[];
  secret?: string;
  active?: boolean;
}

export interface UpdateWebhookPayload {
  url?: string;
  events?: string[];
  secret?: string;
  active?: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  status: string;
  statusCode: number | null;
  attempts: number;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface SendTestResult {
  deliveryId: string | null;
}

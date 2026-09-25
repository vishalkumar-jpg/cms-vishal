import { eq } from "drizzle-orm";
import type { Job, Queue } from "bullmq";
import { CRM_TIMESTAMP_HEADER, signCrmPayload } from "@ob-cms/crypto";
import { db } from "../db/db";
import { webhookDeliveries, webhooks } from "../db/schema";

export interface WebhookDeliveryJobData {
  deliveryId: string;
  siteId: string;
}

const DELIVERY_TIMEOUT_MS = 10_000;
/** Outbound signature header for webhook deliveries (E27). */
const SIGNATURE_HEADER = "x-ob-signature";

/**
 * Signed POST of the exact raw body. Returns the HTTP status; throws on
 * network/timeout/non-2xx (so BullMQ schedules the backoff retry).
 */
async function postSigned(
  url: string,
  secret: string,
  rawBody: string,
): Promise<number> {
  const timestamp = String(Date.now());
  const signature = signCrmPayload(secret, timestamp, rawBody);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // HMAC over `${timestamp}.${rawBody}` (same scheme as forms→CRM). The
        // subscriber verifies with verifyCrmPayload(secret, sig, ts, rawBody).
        [SIGNATURE_HEADER]: signature,
        [CRM_TIMESTAMP_HEADER]: timestamp,
      },
      body: rawBody,
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = new Error(`Subscriber responded ${res.status}`);
      (err as Error & { statusCode?: number }).statusCode = res.status;
      throw err;
    }
    return res.status;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Outbound webhook delivery (E27). One job per `webhook_deliveries` row. Loads
 * the row + its subscription from Postgres (the source of truth), HMAC-signs the
 * stored payload and POSTs to the subscriber URL.
 *
 *  - Idempotency: skip if the delivery is already `delivered`.
 *  - Retry: throwing re-queues with the queue's exponential backoff.
 *  - On the FINAL attempt failing, mark `dead_lettered` + push to the DLQ
 *    (durable mirror) — the delivery row is never lost. MIRRORS crm-delivery.
 */
export async function processWebhookDelivery(
  job: Job<WebhookDeliveryJobData>,
  dlq: Queue,
): Promise<{ delivered: boolean; skipped?: boolean }> {
  const { deliveryId } = job.data;

  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  if (!delivery) return { delivered: false, skipped: true };
  if (delivery.status === "delivered") return { delivered: true, skipped: true };

  const [sub] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, delivery.webhookId))
    .limit(1);
  if (!sub || sub.active === false) {
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", lastError: "subscription missing or inactive" })
      .where(eq(webhookDeliveries.id, deliveryId));
    return { delivered: false, skipped: true };
  }

  await db
    .update(webhookDeliveries)
    .set({ status: "delivering" })
    .where(eq(webhookDeliveries.id, deliveryId));

  const rawBody = JSON.stringify(delivery.payload ?? {});

  try {
    const statusCode = await postSigned(sub.url, sub.secret, rawBody);
    await db
      .update(webhookDeliveries)
      .set({
        status: "delivered",
        statusCode,
        attempts: (delivery.attempts ?? 0) + 1,
        deliveredAt: new Date(),
        lastError: null,
        nextRetryAt: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return { delivered: true };
  } catch (err) {
    const message = (err as Error).message.slice(0, 1000);
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? null;
    const isFinalAttempt = (job.attemptsMade ?? 0) + 1 >= (job.opts.attempts ?? 1);
    await db
      .update(webhookDeliveries)
      .set({
        status: isFinalAttempt ? "dead_lettered" : "failed",
        statusCode,
        attempts: (delivery.attempts ?? 0) + 1,
        lastError: message,
        nextRetryAt: isFinalAttempt ? null : new Date(Date.now() + 5000),
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    if (isFinalAttempt) {
      await dlq.add("dead-letter", { ...job.data, lastError: message });
      console.error(
        `[worker] ALERT webhook DLQ: delivery ${deliveryId} dead-lettered after ` +
          `${(job.attemptsMade ?? 0) + 1} attempts — ${message}`,
      );
    }
    throw err;
  }
}

import { eq } from "drizzle-orm";
import type { Job, Queue } from "bullmq";
import {
  CRM_IDEMPOTENCY_HEADER,
  CRM_SIGNATURE_HEADER,
  CRM_TIMESTAMP_HEADER,
  signCrmPayload,
} from "@ob-cms/crypto";
import { db } from "../db/db";
import { formSubmissions, forms, siteSettings } from "../db/schema";

export interface CrmDeliveryJobData {
  submissionId: string;
  siteId: string;
  formId: string;
}

const DELIVERY_TIMEOUT_MS = 10_000;

/** Resolve the CRM endpoint + secret for a site (per-site config → global env). */
async function resolveCrmConfig(siteId: string): Promise<{
  url: string;
  secret: string;
  dualWrite: boolean;
  legacyUrl: string | null;
}> {
  const [settings] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.siteId, siteId))
    .limit(1);
  const url =
    settings?.crmWebhookUrl ||
    process.env.CRM_WEBHOOK_URL ||
    `http://localhost:${process.env.API_PORT ?? "3001"}/api/dev/mock-crm`;
  const secret =
    settings?.crmHmacSecret ||
    process.env.CRM_HMAC_SECRET ||
    process.env.CRM_MOCK_SECRET ||
    "dev-crm-secret";
  return {
    url,
    secret,
    dualWrite: settings?.crmDualWrite ?? false,
    legacyUrl: settings?.crmLegacyUrl ?? process.env.CRM_LEGACY_URL ?? null,
  };
}

/** Signed POST of the exact raw body. Throws on non-2xx / network / timeout. */
async function postSigned(url: string, secret: string, rawBody: string, idempotencyKey: string): Promise<void> {
  const timestamp = String(Date.now());
  const signature = signCrmPayload(secret, timestamp, rawBody);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [CRM_SIGNATURE_HEADER]: signature,
        [CRM_TIMESTAMP_HEADER]: timestamp,
        [CRM_IDEMPOTENCY_HEADER]: idempotencyKey,
      },
      body: rawBody,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`CRM responded ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * forms→CRM delivery (FORM-14..19). One job per submission. Builds the payload
 * from Postgres (the source of truth), HMAC-signs it, and POSTs to the CRM.
 *
 *  - Idempotency: skip if the submission is already `delivered` (FORM-18).
 *  - Dual-write: when ON, also POST to the legacy HubSpot URL; legacy failures
 *    are logged but non-blocking — `delivered` tracks OUR CRM (FORM-19).
 *  - Retry: throwing re-queues the job with the queue's exponential backoff.
 *  - On the FINAL attempt failing, mark `dead_lettered` + push to the DLQ
 *    (durable mirror) — the submission row is never lost (FORM-16).
 */
export async function processCrmDelivery(
  job: Job<CrmDeliveryJobData>,
  dlq: Queue,
): Promise<{ delivered: boolean; skipped?: boolean }> {
  const { submissionId, siteId, formId } = job.data;

  const [submission] = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.id, submissionId))
    .limit(1);
  if (!submission) {
    // Nothing to deliver — treat as done (e.g. row purged).
    return { delivered: false, skipped: true };
  }
  if (submission.status === "delivered") {
    return { delivered: true, skipped: true }; // idempotent no-op
  }
  if (submission.isSpam) {
    return { delivered: false, skipped: true };
  }

  await db
    .update(formSubmissions)
    .set({ status: "delivering" })
    .where(eq(formSubmissions.id, submissionId));

  const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
  const idempotencyKey = submission.idempotencyKey ?? submission.id;
  const payload = {
    submissionId: submission.id,
    formId,
    formName: form?.name,
    siteId,
    fields: submission.data ?? {},
    submittedAt: submission.createdAt?.toISOString?.() ?? new Date().toISOString(),
    source: submission.meta ?? {},
  };
  const rawBody = JSON.stringify(payload);

  const { url, secret, dualWrite, legacyUrl } = await resolveCrmConfig(siteId);

  try {
    // Dual-write: legacy (HubSpot) first, non-blocking.
    if (dualWrite && legacyUrl) {
      try {
        await postSigned(legacyUrl, secret, rawBody, idempotencyKey);
      } catch (err) {
        console.error(
          `[worker] dual-write legacy POST failed for ${submissionId}: ${(err as Error).message}`,
        );
      }
    }

    // Our CRM = system of record. Its success marks the submission delivered.
    await postSigned(url, secret, rawBody, idempotencyKey);

    await db
      .update(formSubmissions)
      .set({ status: "delivered", deliveredAt: new Date(), lastError: null })
      .where(eq(formSubmissions.id, submissionId));
    return { delivered: true };
  } catch (err) {
    const message = (err as Error).message.slice(0, 1000);
    const isFinalAttempt = (job.attemptsMade ?? 0) + 1 >= (job.opts.attempts ?? 1);
    await db
      .update(formSubmissions)
      .set({
        status: isFinalAttempt ? "dead_lettered" : "failed",
        deliveryAttempts: (submission.deliveryAttempts ?? 0) + 1,
        lastError: message,
      })
      .where(eq(formSubmissions.id, submissionId));

    if (isFinalAttempt) {
      // Durable DLQ mirror + alert. Postgres `dead_lettered` is the real source.
      await dlq.add("dead-letter", { ...job.data, lastError: message });
      console.error(
        `[worker] ALERT forms→CRM DLQ: submission ${submissionId} dead-lettered after ` +
          `${(job.attemptsMade ?? 0) + 1} attempts — ${message}`,
      );
    }
    throw err; // re-throw so BullMQ records the failure / schedules backoff
  }
}

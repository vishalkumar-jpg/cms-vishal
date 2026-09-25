import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Forms→CRM webhook signing (WAVE3b / FORM-14, FORM-18).
 *
 * Scheme (shared by the worker that SIGNS and any receiver that VERIFIES — incl.
 * the local mock CRM):
 *
 *   signature = "sha256=" + HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
 *
 * sent as headers:
 *   X-OBCMS-Signature: sha256=<hex>
 *   X-OBCMS-Timestamp: <unix-ms>
 *   X-Idempotency-Key: <submissionId>
 *
 * The timestamp is bound INTO the signed string so a captured body cannot be
 * replayed with a fresh timestamp. Receivers reject when the timestamp skew
 * exceeds `MAX_SKEW_MS` (replay protection).
 */
export const CRM_SIGNATURE_HEADER = "x-obcms-signature";
export const CRM_TIMESTAMP_HEADER = "x-obcms-timestamp";
export const CRM_IDEMPOTENCY_HEADER = "x-idempotency-key";
export const CRM_MAX_SKEW_MS = 5 * 60 * 1000;

/** Compute the `sha256=<hex>` signature for a raw body + timestamp. */
export function signCrmPayload(secret: string, timestamp: string, rawBody: string): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `sha256=${mac}`;
}

/** Constant-time compare of two signature strings. */
export function safeSignatureEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a received signature against the raw body. Checks both the HMAC and the
 * timestamp skew. Returns false on any malformed/expired/mismatched input.
 */
export function verifyCrmPayload(
  secret: string,
  signature: string | undefined,
  timestamp: string | undefined,
  rawBody: string,
  now: number = Date.now(),
): boolean {
  if (!signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > CRM_MAX_SKEW_MS) return false;
  const expected = signCrmPayload(secret, timestamp, rawBody);
  return safeSignatureEqual(expected, signature);
}

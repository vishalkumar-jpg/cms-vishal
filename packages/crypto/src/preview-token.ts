import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Draft-preview link tokens (content-ops: shareable no-login preview).
 *
 * A preview token is a keyed HMAC over `${entityType}:${entityId}:${secret}`
 * where `secret` is a per-row random nonce stored on the page/post
 * (`preview_token`). Because the nonce is part of the signed material, ROTATING
 * the nonce (regenerate) invalidates every previously-issued link — that is how
 * "revoke" works: set `preview_token = NULL` (or a fresh value) and old links
 * stop validating.
 *
 * The token is a capability: whoever holds a valid token for an entity may view
 * its DRAFT layout with no login. It never encodes anything sensitive and is not
 * reversible — it only proves the holder was granted access at issue time.
 *
 * Scheme:
 *   token = HMAC_SHA256(PREVIEW_TOKEN_SECRET, `${entityType}:${entityId}:${nonce}`) (hex)
 *
 * The server-wide `PREVIEW_TOKEN_SECRET` (env) is mixed in so a leaked row nonce
 * alone cannot forge a token. Both the API (which mints links) and the renderer
 * (which validates) share the same secret + scheme.
 */

/** Resolve the shared preview-token signing secret from env (fail-closed). */
export function previewTokenSecret(): string {
  const secret =
    process.env.PREVIEW_TOKEN_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "";
  if (!secret || secret.trim() === "") {
    throw new Error("PREVIEW_TOKEN_SECRET (or ENCRYPTION_KEY/JWT_SECRET) is not configured");
  }
  return secret;
}

/**
 * Compute the preview token for an entity given its stored per-row nonce.
 * `entityType` is "page" | "post"; `nonce` is the row's `preview_token` value.
 */
export function computePreviewToken(
  entityType: "page" | "post",
  entityId: string,
  nonce: string,
  secret: string = previewTokenSecret(),
): string {
  return createHmac("sha256", secret)
    .update(`${entityType}:${entityId}:${nonce}`)
    .digest("hex");
}

/**
 * Constant-time verify of a candidate token against the entity + stored nonce.
 * Returns false on any malformed/missing input or mismatch (never throws for a
 * bad candidate; only a missing env secret propagates).
 */
export function verifyPreviewToken(
  entityType: "page" | "post",
  entityId: string,
  nonce: string | null | undefined,
  candidate: string | null | undefined,
  secret: string = previewTokenSecret(),
): boolean {
  if (!nonce || !candidate) return false;
  const expected = computePreviewToken(entityType, entityId, nonce, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

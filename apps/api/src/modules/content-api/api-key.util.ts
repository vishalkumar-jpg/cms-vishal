import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * API-key generation + hashing for the public Content API (E27).
 *
 * A key looks like `obk_live_<32 url-safe bytes>`. The plaintext is shown ONCE
 * on creation and never stored — we persist only `sha256(plaintext)` (hex) plus
 * a short non-secret display prefix. A request authenticates by hashing its
 * Bearer token and matching the stored hash (constant-time).
 */
const KEY_ENV_PREFIX = "obk_live_";
/** Chars of the plaintext kept for display (after the env prefix). */
const DISPLAY_CHARS = 6;

export interface GeneratedApiKey {
  /** Full plaintext — returned to the caller ONCE, never persisted. */
  plaintext: string;
  /** Non-secret display prefix, e.g. `obk_live_a1b2c3`. */
  keyPrefix: string;
  /** SHA-256 hex of the plaintext — the only thing stored. */
  keyHash: string;
}

/** Mint a fresh API key (plaintext + its prefix + hash). */
export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(24).toString("base64url");
  const plaintext = `${KEY_ENV_PREFIX}${secret}`;
  return {
    plaintext,
    keyPrefix: `${KEY_ENV_PREFIX}${secret.slice(0, DISPLAY_CHARS)}`,
    keyHash: hashApiKey(plaintext),
  };
}

/** SHA-256 hex of a plaintext key (used for both storage and lookup). */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Constant-time compare of two hex hashes. */
export function safeHashEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

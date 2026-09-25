import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * At-rest encryption for tenant BYOK API keys (WAVE4a).
 *
 * Scheme: AES-256-GCM. The data key comes from env (`ENCRYPTION_KEY`, falling
 * back to `KMS_DATA_KEY`). The envelope format is:
 *
 *   v1:<iv-b64>:<authTag-b64>:<ciphertext-b64>
 *
 * The `v1:` prefix lets us rotate the scheme later. The plaintext key is only
 * ever held transiently inside the provider call — it is NEVER logged or
 * returned over the wire; callers surface a masked hint (`maskSecret`) instead.
 *
 * This is intentionally abstracted behind an `EncryptionService` (in the API)
 * so an AWS KMS-backed implementation can replace the local one with no callers
 * changing — the envelope stays opaque to everything but this module.
 */

const SCHEME = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length

/**
 * Derive a stable 32-byte key from the configured secret. We hash so any-length
 * env value yields a valid AES-256 key (a 64-hex-char value is used verbatim by
 * length, otherwise SHA-256 normalizes it).
 */
export function deriveDataKey(secret: string): Buffer {
  if (!secret || secret.trim() === "") {
    throw new Error("ENCRYPTION_KEY (or KMS_DATA_KEY) is not configured");
  }
  // 64 hex chars => exactly 32 bytes; use as-is.
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, "hex");
  // Otherwise normalize to 32 bytes via SHA-256.
  return createHash("sha256").update(secret, "utf8").digest();
}

/** Encrypt plaintext into the self-describing `v1:iv:tag:ct` envelope. */
export function encryptSecret(plaintext: string, secret: string): string {
  const key = deriveDataKey(secret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SCHEME}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Decrypt a `v1:iv:tag:ct` envelope. Throws on tamper/wrong-key (GCM auth). */
export function decryptSecret(envelope: string, secret: string): string {
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== SCHEME) {
    throw new Error("Malformed ciphertext envelope");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const key = deriveDataKey(secret);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

/**
 * Build a non-reversible masked hint for display, e.g. `sk-a…X9f2` — keeps the
 * first 4 and last 4 chars, masks the middle. Never exposes enough to reconstruct
 * the key. Safe to store in the DB and return over the API.
 */
export function maskSecret(plaintext: string): string {
  const s = plaintext.trim();
  if (s.length <= 8) return "••••";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

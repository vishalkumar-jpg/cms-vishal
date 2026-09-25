import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 (TOTP) + RFC 4648 (Base32), dependency-free via `node:crypto`.
 *
 * No native/3rd-party TOTP dep — this is a small, auditable HMAC-SHA1 impl. The
 * secret is a Base32 string (what authenticator apps expect in the otpauth URI).
 *
 * Parameters are the universal authenticator-app defaults: SHA1, 6 digits, 30s
 * period — so Google Authenticator / 1Password / Authy all interoperate.
 */

const DIGITS = 6;
const PERIOD_SECONDS = 30;
const ALGO = "sha1";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Generate a random Base32 TOTP secret (default 20 bytes = 160 bits, RFC 4226). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

/** RFC 4648 Base32 encode (no padding) — what otpauth URIs use. */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/** RFC 4648 Base32 decode (case-insensitive, ignores spaces/padding). */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid Base32 character in TOTP secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Compute the TOTP code for a given Base32 secret at a given unix time (s). */
export function totp(secretBase32: string, atSeconds: number = Date.now() / 1000): string {
  const counter = Math.floor(atSeconds / PERIOD_SECONDS);
  return hotp(secretBase32, counter);
}

/** RFC 4226 HOTP for an explicit counter (used by TOTP per time-step). */
export function hotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const msg = Buffer.alloc(8);
  // 64-bit big-endian counter (JS-safe: split into hi/lo 32-bit words).
  msg.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac(ALGO, key).update(msg).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/**
 * Verify a user-supplied code against the secret, tolerating ±`window` steps of
 * clock drift (default ±1 = ±30s). Constant-time digit comparison.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  window = 1,
  atSeconds: number = Date.now() / 1000,
): boolean {
  const normalized = code.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(atSeconds / PERIOD_SECONDS);
  for (let drift = -window; drift <= window; drift += 1) {
    const candidate = hotp(secretBase32, counter + drift);
    const a = Buffer.from(candidate);
    const b = Buffer.from(normalized);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Build the otpauth:// URI an authenticator app scans as a QR code. */
export function buildOtpAuthUri(
  secretBase32: string,
  account: string,
  issuer = "OB-CMS",
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

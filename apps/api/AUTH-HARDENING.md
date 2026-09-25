# Auth hardening (gap C21)

Refresh-on-401 + 2FA (TOTP) for OB-CMS. Custom granular roles remain a
**follow-up** (out of scope here — see "Follow-ups").

## Token lifetimes

| Token | Cookie | TTL | Form |
|-------|--------|-----|------|
| Access | `ob_session` (httpOnly) | **15m** (`ACCESS_TOKEN_EXPIRY`) | JWT (HS256), verified by `JwtAuthGuard` |
| Refresh | `ob_refresh` (httpOnly) | **7d** (`REFRESH_TOKEN_EXPIRY`) | opaque 32-byte random; only its SHA-256 hash is stored |
| CSRF | `ob_csrf` (readable) | session | double-submit token (unchanged) |

The previous 12h access-token stopgap is removed: `.env` / `.env.example` now set
`ACCESS_TOKEN_EXPIRY=15m`, matching `authConfig.accessTokenTtlMs` (the access
cookie `maxAge`). Both auth cookies are `httpOnly`, `SameSite=Lax`, `Secure`
outside local dev, `path=/`.

## Refresh rotation + revocation

New table **`refresh_tokens`** (prefix `rft`, migration `0014_auth_hardening.sql`):
`user_id`, `token_hash` (SHA-256 of the raw cookie value), `expires_at`,
`used_at`, `revoked_at`. The raw refresh token lives **only** in the `ob_refresh`
cookie — never in the DB.

- **Login / signup** → `buildSession` mints an access JWT + a fresh opaque refresh
  token, inserts one `refresh_tokens` row, sets both cookies.
- **`POST /auth/refresh`** → looks the row up by hash; rejects if missing,
  revoked, or expired. On success it **rotates**: marks the old row `used_at` and
  inserts a new row, returning a new access + refresh cookie pair.
- **Reuse detection**: a token presented after it was already `used_at` (rotation)
  is treated as theft — the user's entire refresh chain is revoked and the call
  401s.
- **Logout** (`POST /auth/logout`) → revokes every outstanding refresh token for
  the user (`revoked_at`) and clears both cookies. A stolen refresh cookie cannot
  mint new access tokens after logout.
- **Password reset** also revokes all refresh tokens (invalidate all sessions).

## CSRF interplay

`POST /auth/refresh` is annotated `@Public()`. In this codebase `@Public` both
skips `JwtAuthGuard` (correct — the access token may be expired; the refresh
cookie is the credential) **and** exempts the route from `CsrfGuard` — exactly
like `/auth/login`. This keeps the SPA flow working: the refresh-on-401
interceptor can fire without first reading a CSRF token. The defenses for refresh
are the secrecy of the opaque refresh token plus `SameSite=Lax`. All other
cookie-authenticated mutations keep the unchanged double-submit CSRF check, and
the tenant-isolation / platform-admin e2e flows (login → cookie → CSRF →
mutations) are untouched. Guard order in `common.module.ts` is unchanged.

## TOTP scheme (RFC 6238)

`common/auth/totp.util.ts` — a small, dependency-free implementation over
`node:crypto` (HMAC-SHA1, 6 digits, 30s period; ±1 step drift window) plus RFC
4648 Base32 encode/decode. No native dependency added.

- `system_users.totp_secret` (text) stores the Base32 secret **encrypted at rest**
  via `@ob-cms/crypto` (`encryptSecret`, same `ENCRYPTION_KEY` as BYOK keys).
- `system_users.totp_enabled` (boolean) gates enforcement.
- `POST /auth/2fa/setup` → generates a secret, stores it encrypted (pending,
  `totp_enabled` stays false), returns `{ secret, otpauthUrl }` for the SPA to
  render/copy.
- `POST /auth/2fa/enable` → verifies a code against the pending secret → flips
  `totp_enabled` on.
- `POST /auth/2fa/disable` → verifies a current code **or** the account password →
  flips off and clears the secret.
- `POST /auth/login` → if `totp_enabled`, a valid `totp` code in the body is
  required before any session is issued; a missing/wrong code returns 401.

## Admin flows

- **Axios interceptor** (`apps/admin/src/services/AxiosService.ts`): on a 401
  (except `/auth/login`, `/auth/refresh`, `/auth/logout`) it calls
  `POST /auth/refresh` **once** and replays the original request. Concurrent 401s
  share a single in-flight refresh (`refreshPromise` single-flight). Each request
  retries at most once (`_retried`); if refresh fails, `onUnauthorized` fires and
  the user is sent to `/login`.
- **Login** (`views/login/Login.tsx`): on a "two-factor required" 401 it reveals a
  6-digit code field and re-submits with the code.
- **Security page** (`views/security/Security.tsx`, route `/security`, one
  "Security" sidebar entry under SITE): enable 2FA (shows secret + otpauth URI to
  add to an authenticator app, then verify a code), disable 2FA (code or
  password), and an active-sessions note.

## Follow-ups

- **Custom granular roles (RBAC)** — out of scope for C21. Roles remain the
  per-site hierarchy in `site_members` enforced by `RolesGuard`.
- Render an actual QR image (no QR lib is currently bundled; the admin shows the
  secret + otpauth URI to paste).
- Recovery/backup codes for 2FA.

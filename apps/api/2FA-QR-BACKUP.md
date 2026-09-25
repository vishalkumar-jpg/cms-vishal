# 2FA — scannable QR + backup recovery codes (C21 follow-up)

Completes the two "Follow-ups" left open by `AUTH-HARDENING.md`: rendering the
otpauth URI as a scannable QR image, and single-use backup recovery codes. The
existing TOTP enroll/verify/login flow is unchanged; these are additive.

## 1. QR code — rendered server-side (no new admin dependency)

`POST /auth/2fa/setup` already returned `{ secret, otpauthUrl }`. It now also
returns **`qrDataUri`** — the otpauth URI rendered as an SVG QR encoded as a
`data:image/svg+xml;base64,...` URL. The Security page shows it in an `<img>`
alongside the manual secret fallback (paste-the-secret path is retained).

**Why server-side.** The `qrcode` npm package is not installed and the sandbox
cannot run `bun install`, so adding it as an admin dependency would break
`apps/admin` `bun run build`. Instead the QR is generated in the API by a small,
dependency-free encoder: `apps/api/src/common/auth/qr.util.ts` — an ISO/IEC 18004
byte-mode implementation (Reed-Solomon over GF(256), EC level M, versions 1..10,
all 8 mask patterns scored by the standard penalty). otpauth URIs are ASCII and
fit comfortably in version ≤10 at level M. `qrSvgDataUri(text)` returns the
data-URL; a 4-module quiet zone and `shape-rendering="crispEdges"` keep it
scannable. No native/3rd-party dep is added anywhere.

## 2. Backup recovery codes

**Storage.** New table **`totp_backup_codes`** (prefix `bkc`, schema
`apps/api/src/database/schema/totp-backup-codes.schema.ts`): `user_id` (FK →
`system_users`, `ON DELETE cascade`), `code_hash`, `used_at`. Only the SHA-256
hash of the normalized code is stored (via `@ob-cms/crypto`-adjacent
`node:crypto` `sha256`, same helper the auth service uses for reset tokens). Raw
codes never touch the DB.

**Generation.** On `POST /auth/2fa/enable` (after the TOTP code verifies), the
service mints **10** codes formatted `A1B2-C3D4-E5F6` from an unambiguous
alphabet (no 0/O/1/I/L). Enable now returns `{ backupCodes: string[] }`; the
Security page shows them **once** with copy + download (`.txt`) affordances and a
"save these" warning, then discards them from client state.

**Verification at login.** `LoginDto` gains an optional `backupCode`. When a 2FA
user logs in with `backupCode` instead of `totp`, the service hashes the
normalized value and matches it against the user's **unused** rows; a match sets
`used_at` (single-use) and login proceeds. A second use of the same code finds no
unused row → 401 `Invalid backup recovery code`. The login form has a "Use a
backup recovery code instead" toggle. The remaining-count is recorded in the
audit log (`metadata.remaining`).

**Regeneration.** `POST /auth/2fa/backup-codes` re-verifies a current TOTP code
OR the account password, deletes the prior set, and returns a fresh batch (shown
once). Old codes are invalidated by the delete.

**Disable.** `POST /auth/2fa/disable` now also deletes all of the user's backup
codes (in the same transaction that clears `totp_secret` / `totp_enabled`).

## 3. Migration

`0021_totp_backup_codes.sql` (+ `meta/_journal.json` idx 21) creates the table,
FK, and two indexes (`bkc_user_idx`, `bkc_code_hash_idx`). All statements are
`IF NOT EXISTS` / duplicate-safe, so re-apply is a no-op. Drizzle applies it via
`bun run db:migrate`.

## 4. Audit

New/updated audit actions (category `sessions`):
`user.2fa_enabled` (now with `backupCodesIssued`),
`user.2fa_disabled`, `user.2fa_backup_codes_regenerated`,
`user.2fa_backup_code_used` (with `remaining`).

## Touch list

- `common/auth/qr.util.ts` (new), `modules/auth/auth.service.ts`,
  `auth.controller.ts`, `dto/auth.dto.ts`
- `database/schema/totp-backup-codes.schema.ts` (new) + `schema/index.ts`
- `database/migrations/0021_totp_backup_codes.sql` + `meta/_journal.json`
- admin: `views/security/Security.tsx`, `views/login/Login.tsx`,
  `views/auth/api/auth.api.ts`, `views/auth/hooks/useAuth.ts`

CSRF/tenant guards, `@Public` set, and cookie behavior are untouched.

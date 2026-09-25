# Invitations & Audit-log UI

Two governance features for OB-CMS: invite teammates by **email**, and surface the
existing **audit log** in the admin.

## A. Email invitations

### Schema — `ob_cms.site_invitations` (prefix `inv`)
Migration: `src/database/migrations/0009_invitations.sql` (journal idx 9, idempotent
`CREATE TABLE IF NOT EXISTS`). Drizzle: `src/database/schema/site-invitations.schema.ts`
(exported from the schema barrel).

| column | notes |
| --- | --- |
| `site_id` | NOT NULL, FK → sites (cascade) |
| `email` | lowercased/normalized |
| `role` | site_admin \| editor \| contributor |
| `token` | unique random 64-hex (`randomBytes(32)`) — backs the accept link |
| `status` | `pending` \| `accepted` \| `revoked` \| `expired` |
| `invited_by` | FK → system_users (set null) |
| `expires_at` | NOT NULL, +7 days from creation |
| `accepted_at` | set on accept |

Plus base columns (KSUID id, created/updated/deleted, created/updated_by).
Indexes: `inv_token_uq` (unique), `inv_site_status_idx`, `inv_email_idx`.

### API — `modules/invitations`
Management (header-scoped via `X-Site-Id`, `@Roles("site_admin")`, audited):
- `POST /api/invitations` `{ email, role }` → creates a pending invite. Rejects if the
  email is already an active member or an active pending invite exists. Sends the invite
  email via `MailService` and returns the invite **including `acceptUrl`** (dev convenience).
- `GET /api/invitations` → list for the active site (newest first).
- `POST /api/invitations/:id/resend` → extends expiry +7d and re-sends.
- `DELETE /api/invitations/:id` → revoke.

Public (token-resolved, `@Public`):
- `GET /api/v1/public/invitations/:token` → `{ siteName, email, role, expired }`.
- `POST /api/v1/public/invitations/:token/accept` `{ name?, password? }` → if a user with the
  email exists, attach a `site_members` row with the invited role; else create the user
  (reusing `PasswordService.hash`) + membership. Marks `accepted`. **Idempotent**; rejects
  expired/revoked (and flips an expired invite's status to `expired`). Runs in a txn; the
  `team.invite_accepted` audit row commits with it.

### Accept-link env var
`APP_PUBLIC_URL` (default `http://localhost:5001`) — base for the link
`${APP_PUBLIC_URL}/accept-invite?token=...`. Documented in `.env` / `.env.example`.

Emails go to **MailHog** locally (`SMTP_HOST`/`SMTP_PORT`, UI at http://localhost:8025).

### Admin UI
- `views/members/Members.tsx`: an **Invite by email** dialog (email + role; super_admin
  excluded) and a **Pending invitations** table (copy-link / resend / revoke). Existing
  members UI unchanged. API/hooks: `views/members/api/invitations.api.ts`,
  `views/members/hooks/useInvitations.ts`.
- `views/invitations/AcceptInvite.tsx` at route `/accept-invite` (**outside** `ProtectedRoute`
  in `routes/router.tsx`): reads `?token`, previews, collects name + password, accepts, then
  routes to `/login`.

## B. Audit-log UI

### Endpoint — PRE-EXISTING
`GET /api/sites/:siteId/audit` already existed (`modules/audit/audit.controller.ts`),
site-scoped via `ScopedRepository`, newest-first, `@Roles("contributor")`, with a
`category` filter. **Extended (additively):**
- new query params `action`, `entityType`, `limit` (default 50, max 200), `offset`;
- response now joins `system_users` for `actorEmail` and returns a paginated envelope
  `{ rows: [...], hasMore, limit, offset }` (was a bare array). Each row:
  `{ id, siteId, actorId, actorEmail, action, category, entityType, entityId, metadata, createdAt }`.
  The tenant-isolation e2e test was updated to read `data.rows`.

### Admin UI
`views/audit/AuditLog.tsx` at route `/audit` (sidebar **SITE → Audit log**): read-only table
(When · Actor · Action · Entity · Details) with action/entity-type filters and **Load more**
pagination (`useInfiniteQuery`). API/hooks: `views/audit/api/audit.api.ts`,
`views/audit/hooks/useAudit.ts`.

Invite **create** (`team.invite_created`) and **accept** (`team.invite_accepted`), plus
resend/revoke, all write audit rows visible in this UI.

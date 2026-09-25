# Content-Ops: Draft Preview Links · Concurrent-Edit Locking · Scheduled Unpublish

Three content-ops features for pages **and** blog posts. All API routes are
tenant-scoped via `X-Site-Id` (through `ScopedRepository`) except the public
preview render, which is `@Public` + host-resolved.

Migration: `apps/api/src/database/migrations/0028_content_ops.sql`
(adds `pages.expires_at`, `pages.preview_token`, `posts.expires_at`,
`posts.preview_token`, and the `content_locks` table — all IF-NOT-EXISTS).

---

## 1. Draft preview links (tokenized, no login)

**Token scheme** (`packages/crypto/src/preview-token.ts`):

```
token = HMAC_SHA256(PREVIEW_TOKEN_SECRET, `${entityType}:${entityId}:${nonce}`)  // hex
```

- `nonce` is a per-row random value stored in `pages/posts.preview_token`.
- `PREVIEW_TOKEN_SECRET` is a server-wide env secret (falls back to
  `ENCRYPTION_KEY`/`JWT_SECRET`) so a leaked nonce alone can't forge a token.
- The token is a **capability**: whoever holds a valid one may view the DRAFT,
  no login. It's not reversible and encodes nothing sensitive.

**Mint / revoke** (editor role):
- `POST /api/v1/pages/:id/preview-link` → `{ url, token }` where
  `url = https://<site-host>/__preview/page/<id>?token=…`. Idempotent while the
  nonce is unchanged. `POST /api/v1/posts/:id/preview-link` mirrors it.
- `DELETE /api/v1/{pages,posts}/:id/preview-link` → sets `preview_token = NULL`
  (**revoke**): every previously-issued link stops validating immediately.

**Preview route** — API `@Public` `GET /api/v1/public/preview/{page,post}/:id?token=`
(`PublicRenderService.previewPage/previewPost`): host-resolves the site, checks
the entity belongs to it, `verifyPreviewToken(...)` (constant-time) → 403 on a
wrong/revoked token, returns the **draft** layout (not cached, `no-store`).

**Renderer** — `apps/renderer/src/app/%5F%5Fpreview/[type]/[id]/page.tsx` serves
`/__preview/<type>/<id>?token=` (the `%5F%5F` folder escapes Next's private-folder
underscore rule so the literal `__preview` segment stays routable). Renders the
DRAFT with a sticky **"🔒 PREVIEW — not published"** banner; `robots noindex`,
`force-dynamic`. A 403/404 from the API both surface as `notFound()` so a bad
token can't probe existence.

**Admin** — a "copy preview link" (Link2) button in both builder toolbars mints
+ `navigator.clipboard.writeText` + toasts.

---

## 2. Concurrent-edit locking (soft / advisory)

**Model** — `content_locks` (`apps/api/.../schema/content-locks.schema.ts`):
one row per `UNIQUE(site_id, entity_type, entity_id)` with `{ userId, userName,
acquiredAt, heartbeatAt }`. A lock is **stale/free** after `LOCK_STALE_MS`
(2 min) without a heartbeat.

**API** (`ContentLocksService`, contributor role):
- `GET /api/v1/{pages,posts}/:id/lock` → `{ locked, holder, mine }` (stale ⇒ free).
- `POST /api/v1/{pages,posts}/:id/lock` `{ takeOver? }` → acquire/heartbeat. Refresh
  when the caller holds it, **steal** when stale or `takeOver:true`, otherwise
  return the live holder unchanged (`mine:false`).
- `DELETE /api/v1/{pages,posts}/:id/lock` → release (holder only, idempotent).

**Never hard-blocks a save** — advisory only.

**Admin** (`views/builder/lock/*`) — `useEditLock(entity, id)` acquires on
mount, **heartbeats every 30 s**, releases on unmount. When another editor holds
a live lock, `EditLockBanner` shows **"🔒 X is editing"** with **View-only** vs
**Take over** (steals the lock). Wired into both `BuilderShell` (pages) and
`PostBuilderShell` (posts).

---

## 3. Scheduled unpublish / content expiry

**Field** — `pages.expires_at` / `posts.expires_at` (nullable timestamptz).
Set/clear via `PATCH /api/v1/{pages,posts}/:id { expiresAt: ISO | null }`. **Cleared on
manual publish** (the publish path sets `expiresAt: null`) unless re-set.

**Worker job** — `apps/worker/src/processors/content-expiry.processor.ts`, a
repeatable **per-minute** BullMQ job (queue `content-expiry`, cron
`CONTENT_EXPIRY_CRON` default `* * * * *`). It updates every **published** row
whose `expires_at <= now` to `status = 'draft'` (+ `workflow_state = 'draft'`,
`expires_at = NULL`) and purges the renderer cache (`render:<siteId>:*` +
`sitemap:<siteId>`) so the content disappears from the public site + sitemap
immediately. Idempotent; never crashes the worker. It does **not** touch the
scheduled-publish path — only already-published rows.

**Admin** — an "Expires" `datetime-local` field next to Schedule
(`ScheduleDialog` for pages, `PostSettingsDialog` for posts) and an
`Expires <date>` warning badge in both list views.

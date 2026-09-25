# Content API & Outbound Webhooks (gap E27)

A public, read-only Content API (API-key auth) plus outbound webhooks so external
apps can consume a site's published content and be notified on publish events.

## 1. Authentication model

The Content API uses **per-site API keys** — the key **is** the tenant.

- Keys are minted in the admin **API & Webhooks** screen (`/developers`).
  The plaintext (`obk_live_…`) is shown **once** on creation and never stored —
  only `sha256(plaintext)` (hex) + a short non-secret display prefix are persisted
  in `api_keys`.
- A request authenticates with `Authorization: Bearer <key>`. `ContentApiKeyGuard`
  hashes the presented token (SHA-256), constant-time matches `api_keys.key_hash`,
  rejects revoked/soft-deleted keys, and resolves the site from the matched key's
  `site_id`. There is **no** `X-Site-Id` header on these routes — a key can only
  ever read its own site (no cross-tenant surface).
- The Content API controller is `@Public` (opts out of the cookie/JWT + tenant +
  roles guards) and uses `ContentApiKeyGuard` instead. The global Redis rate-limit
  guard still applies (per-IP by default).
- `api_keys.last_used_at` is stamped best-effort on each authenticated request
  (light usage audit; never blocks the request).

Admin management of keys (`/api/v1/api-keys`, `@Roles("site_admin")`, audited):
`GET` (list, no secret), `POST` (create → returns plaintext once), `DELETE`
(revoke = set `revoked_at` + soft-delete).

## 2. Content endpoints — `/api/v1/content` (Bearer key)

All lists are offset-paginated (`?limit` 1–100 default 20, `?offset`) and return
the standard `{ data, status }` envelope. Only **published** content is returned.

| Method & path | Returns |
| --- | --- |
| `GET /pages` | published pages (id, slug, title, seo, publishedAt) |
| `GET /pages/:slug` | one published page incl. `layout` (publishedLayout) + seo |
| `GET /posts` | published posts (cards: title, slug, excerpt, coverUrl…) |
| `GET /posts/:slug` | one published post incl. `layout`, seo, terms, cover |
| `GET /collections/:slug/items` | published items of a collection (+ field schema) |
| `GET /collections/:slug/items/:itemSlug` | one published collection item |
| `GET /media` | ready media (id, url, type, alt, width/height, size) |

Auth failures (missing/blank/invalid/revoked key) → **401**. A key never sees
another site's content (the site id comes from the key, not the request).

## 3. Webhooks

Subscriptions live in `webhooks` (siteId, url, events[], secret, active). Each
delivery attempt is logged in `webhook_deliveries` (event, payload, status,
statusCode, attempts, lastError, nextRetryAt).

Admin CRUD (`/api/v1/webhooks`, `@Roles("site_admin")`, audited): list (no secret),
create (returns the generated `whsec_…` signing secret **once**), update, delete,
`GET /:id/deliveries` (log), `POST /:id/test` (send a signed test event now).

### Events

`page.published`, `post.published`, `form.submitted` (admin-selectable). The
worker also emits the internal `webhook.test` event for the test button.

### Payload + signature scheme

The worker POSTs the JSON envelope to the subscriber URL:

```json
{ "event": "page.published", "siteId": "sit_…", "occurredAt": "ISO-8601", "data": { … } }
```

with headers:

```
Content-Type: application/json
X-OB-Signature: sha256=<hex HMAC>
X-OBCMS-Timestamp: <unix-ms>
```

The signature is `HMAC_SHA256(secret, "${timestamp}.${rawBody}")` (hex), the
**same scheme** as the existing forms→CRM HMAC (`@ob-cms/crypto` `signCrmPayload`).
Subscribers verify with `verifyCrmPayload(secret, signature, timestamp, rawBody)`
(rejects on >5-min skew → replay protection).

### Delivery reliability (worker)

`apps/worker/src/processors/webhook-delivery.processor.ts` **mirrors**
`crm-delivery.processor.ts`: loads the `webhook_deliveries` row + its subscription
from Postgres (the source of truth), signs + POSTs (10s timeout), records
`status`/`statusCode`/`attempts`, retries with exponential backoff (5 attempts),
and on exhaustion marks the row `dead_lettered` + mirrors it to the
`webhook-delivery-dlq` queue. Queue: `webhook-delivery` (BullMQ, prefix `ob-cms`).

## 4. Event bus / emission wiring

**There is no internal application-wide event bus** in this codebase (the only
event-ish seam is BullMQ queues). Emission is therefore done via an explicit
**`WebhooksEmitter`** service (`modules/webhooks/webhooks-emitter.service.ts`),
exported from `WebhooksModule`. It looks up matching active subscriptions, writes
a durable `webhook_deliveries` row per match, and enqueues a delivery job.

The **send-test path is fully functional today** (`POST /api/v1/webhooks/:id/test`
→ emitter → delivery row → worker signs + POSTs), so delivery is verifiable now.

To raise real events, inject `WebhooksEmitter` and add **one line** at each
already-centralized publish site (these modules are owned by other in-flight
work, so the calls are documented here rather than edited in):

- **Page publish** — `modules/pages/pages.service.ts`, in the `publish(...)`
  method after the row flips to `status: "published"`:
  ```ts
  await this.webhooks.emit(this.repo.siteId, "page.published", { id: row.id, slug: row.slug, title: row.title, publishedAt: row.publishedAt });
  ```
- **Post publish** — `modules/blog/blog.service.ts`, in the post `publish(...)`
  method:
  ```ts
  await this.webhooks.emit(this.repo.siteId, "post.published", { id: post.id, slug: post.slug, title: post.title, publishedAt: post.publishedAt });
  ```
- **Form submitted** — `modules/forms/public-forms.service.ts`, right after the
  submission row is stored (next to `enqueueCrmDelivery`):
  ```ts
  await this.webhooks.emit(site.id, "form.submitted", { submissionId: row.id, formId: form.id, fields: row.data });
  ```

Each call requires importing `WebhooksModule` (or just `WebhooksEmitter`) into the
respective feature module. `emit()` never throws into the caller's flow (a webhook
problem must not fail a publish) — failures are logged and the durable delivery
rows + DLQ provide the safety net.

## 5. Schema / migration

Migration `0012_content_api.sql` adds `api_keys`, `webhooks`,
`webhook_deliveries` (all `site_id NOT NULL`, FK→sites, indexed; `api_keys`
uniquely indexes `key_hash` for the auth lookup). Apply with `bun run db:migrate`.

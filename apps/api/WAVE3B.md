# WAVE 3b — Forms + forms→CRM reliability pipeline + public render API

Owner lanes: `apps/api`, `apps/worker`, additive `packages/shared`. Do NOT touch `apps/renderer`.

## 1. Tables (migration `0002_wave3_forms.sql`)

| Table | Prefix | Purpose | Key columns |
|---|---|---|---|
| `forms` | `frm` | Marketer-authored form (tenant-scoped) | `siteId`, `name`, `status` (draft\|published), `fields` jsonb, `settings` jsonb, `crmMapping` jsonb. UNIQUE(siteId,name) |
| `form_submissions` | `fsb` | **Safety net** — every submission persisted before delivery | `siteId`, `formId`, `data`, `meta`{ip,ua,referrer,utm}, `status` (stored\|delivering\|delivered\|failed\|dead_lettered), `deliveryAttempts`, `lastError`, `deliveredAt`, `idempotencyKey` (UNIQUE = submission id), `isSpam` |
| `mock_crm_receipts` | `mcr` | Local-dev sink for the mock CRM receiver | `siteId`, `formId`, `submissionId`, `idempotencyKey`, `signatureValid`, `payload` |

Additive columns on `site_settings`: `crm_webhook_url`, `crm_hmac_secret` (write-only via API), `crm_dual_write` (bool), `crm_legacy_url`.

Schema files: `src/database/schema/forms.schema.ts`, `mock-crm-receipts.schema.ts`, edited `site-settings.schema.ts`; all exported from `schema/index.ts`. Migration journal entry `idx:2 0002_wave3_forms`.

## 2. Modules

- `src/modules/forms/` — `FormsModule` (admin CRUD/submissions/export/resend/CRM-config), `PublicFormsController` (@Public submit + schema), `MockCrmController` (dev-only). Imports `SeoModule` for `SiteResolver`.
- `src/modules/public/` — `PublicModule` render API (host-resolved, Redis-cached). Imports `SeoModule`.
- Both registered in `app.module.ts`.

## 3. Endpoints (method · path · auth)

### Admin forms (tenant-scoped, X-Site-Id; ScopedRepository; audited)
| Method · Path | Min role |
|---|---|
| GET `/api/v1/forms` | contributor |
| POST `/api/v1/forms` | contributor (draft) |
| GET `/api/v1/forms/:id` | contributor (404 cross-tenant) |
| PATCH `/api/v1/forms/:id` | editor |
| POST `/api/v1/forms/:id/publish` | editor (contributor→403) |
| DELETE `/api/v1/forms/:id` | editor |
| GET `/api/v1/forms/:id/submissions` | contributor (paginated) |
| GET `/api/v1/forms/:id/submissions/export` | editor (CSV, formula-injection-safe) |
| GET `/api/v1/forms/submissions/:sid` | contributor |
| POST `/api/v1/forms/submissions/:sid/resend` | editor |
| GET `/api/v1/forms/crm-config` | site_admin (secret never returned) |
| PUT `/api/v1/forms/crm-config` | site_admin (secret write-only) |

### Public (@Public, host→site server-side; NO client siteId)

| Method · Path |
|---|---|
| GET `/api/v1/public/forms/:formId` (published form schema: fields+settings only) |
| POST `/api/v1/public/forms/:formId/submit` (persist→enqueue; honeypot+timing+rate-limit; 64KB cap) |
| GET `/api/v1/public/site` (site + theme tokens + public settings; 404 unknown host) — cached |
| GET `/api/v1/public/page?path=/some/path` (publishedLayout + seo + schemaVersion; 404; never drafts) — cached `render:<siteId>:page:<slug>` |
| GET `/api/v1/public/navigation` (header/footer trees) — cached |
| GET `/api/v1/public/redirect?path=` (→ {to,status} or null) — cached |

### Dev (non-production only)

| Method · Path |
|---|---|
| POST `/api/v1/dev/mock-crm` (@Public) — verifies HMAC over raw body, stores receipt, 200 on valid / 401 on bad sig |

## 4. Queues (+ DLQ)

`src/modules/queue/queue.constants.ts` adds `CRM_DELIVERY="crm-delivery"`, `CRM_DELIVERY_DLQ="crm-delivery-dlq"`. `QueueService.enqueueCrmDelivery({submissionId,siteId,formId})` — `jobId=crm:<submissionId>`, `attempts:5`, exponential backoff `delay:5000`.

Worker (`apps/worker/src/`):
- `crm-delivery` processor — loads submission (Postgres = source of truth), builds `{submissionId,formId,formName,siteId,fields,submittedAt,source}`, HMAC-signs, POSTs. 2xx→`delivered`(+deliveredAt). Idempotent (skips already-`delivered`). Dual-write to legacy URL (non-blocking) when `crm_dual_write`. Throw→BullMQ backoff retry. Final attempt fail → push to `crm-delivery-dlq` + `status=dead_lettered` + ALERT log.
- `cache-purge` processor — clears `render:<siteId>:*` (page/site/nav/redirect) on publish.
- `crm-sweeper` — in-process 60s interval; re-enqueues non-spam `stored`/`failed`/`delivering` rows older than 60s (survives Redis flush).

Only ids travel through Redis (no lead PII in the queue). Postgres `dead_lettered` is the durable DLQ mirror; replay reads from Postgres via `resend`.

## 5. HMAC scheme (`packages/shared/src/crm-hmac.ts`)

```
signature = "sha256=" + HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
headers:  X-OBCMS-Signature: sha256=<hex>
          X-OBCMS-Timestamp: <unix-ms>
          X-Idempotency-Key: <submissionId>
```
Timestamp bound into the signed string (replay-safe); receiver rejects skew > 5 min. Per-site secret (`site_settings.crm_hmac_secret`) → global `CRM_HMAC_SECRET`/`CRM_MOCK_SECRET` → `dev-crm-secret`. `signCrmPayload` (worker) and `verifyCrmPayload` (mock CRM / any receiver) shared from `@ob-cms/shared`.

## 6. Migration file

`apps/api/src/database/migrations/0002_wave3_forms.sql` (+ journal `idx:2`). Idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DO $$ … duplicate_object`).

## 7. Acceptance by construction

1. `bun run type-check` — strict TS mirroring existing patterns; unused imports removed.
2. Migration creates `forms`/`form_submissions`/`mock_crm_receipts` + site_settings CRM columns.
3. Public submit ALWAYS inserts the `form_submissions` row (status `stored`) before enqueue → a CRM outage never loses a lead; worker delivers with valid HMAC; forced failure (bad URL/secret) exhausts retries → DLQ + `dead_lettered`. Status transitions stored→delivering→delivered / failed → dead_lettered.
4. `GET /api/v1/public/page?path=/home` returns the published OB page by host (officebeacon.localhost) + path.
5. Public endpoints resolve site by Host only (never a client siteId). e2e spec extended (`test/tenant-isolation.e2e-spec.ts`): A creates/publishes a form, B denied (403/404), public submit persists scoped to A, unknown form/host → 404.

## 8. Verify commands

```bash
# 0. apply migration + boot api + worker
bun run --filter @ob-cms/api migrate         # or the repo's migrate task
bun run --filter @ob-cms/api dev &
bun run --filter @ob-cms/worker dev &

# --- assume an authed editor cookie ($C) + site ($S) + host officebeacon.localhost ---

# 1. create + publish a form
FORM=$(curl -s -X POST localhost:3001/api/forms -H "Cookie: $C" -H "x-site-id: $S" \
  -H 'content-type: application/json' \
  -d '{"name":"Contact","fields":[{"type":"email","label":"Email","name":"email","required":true}],"settings":{"successMessage":"Thanks!","spamProtection":{"minSubmitSeconds":0}}}' | jq -r .data.id)
curl -s -X POST localhost:3001/api/forms/$FORM/publish -H "Cookie: $C" -H "x-site-id: $S"

# 2. PUBLIC submit (host-resolved; no siteId) → persists then enqueues
curl -s -X POST localhost:3001/api/v1/public/forms/$FORM/submit -H 'Host: officebeacon.localhost' \
  -H 'content-type: application/json' -d '{"data":{"email":"lead@example.com"}}'

# 3. submission stored (even if CRM down)
curl -s localhost:3001/api/forms/$FORM/submissions -H "Cookie: $C" -H "x-site-id: $S" | jq '.data.total,.data.rows[0].status'

# 4. worker delivers to mock-CRM with valid HMAC → check receipts table
#    (status transitions to "delivered"; mock_crm_receipts.signature_valid = true)

# 5. force DLQ: PUT crm-config with an unreachable URL, resend, watch attempts → dead_lettered
curl -s -X PUT localhost:3001/api/forms/crm-config -H "Cookie: $C" -H "x-site-id: $S" \
  -H 'content-type: application/json' -d '{"crmWebhookUrl":"http://127.0.0.1:1/nope"}'
SID=$(curl -s localhost:3001/api/forms/$FORM/submissions -H "Cookie: $C" -H "x-site-id: $S" | jq -r .data.rows[0].id)
curl -s -X POST localhost:3001/api/forms/submissions/$SID/resend -H "Cookie: $C" -H "x-site-id: $S"
# after ~5 backed-off attempts: status=dead_lettered, job in crm-delivery-dlq (bull-board)

# 6. public render endpoints
curl -s 'localhost:3001/api/v1/public/site' -H 'Host: officebeacon.localhost' | jq '.data.site.id'
curl -s 'localhost:3001/api/v1/public/page?path=/home' -H 'Host: officebeacon.localhost' | jq '.data.slug'
curl -s 'localhost:3001/api/v1/public/navigation' -H 'Host: officebeacon.localhost'
curl -s 'localhost:3001/api/v1/public/redirect?path=/old' -H 'Host: officebeacon.localhost'
```

## Notes / observability
- Existing bull-board (if mounted) auto-discovers the new `crm-delivery` + `crm-delivery-dlq` queues since they register on the shared BullMQ root (`QueueModule`). No bull-board was found in the repo at WAVE3b time; when one is added, point it at the same Redis/prefix `ob-cms` and it will list these queues.
- Delivery status is observable via `GET /api/v1/forms/submissions/:sid` (`status`, `deliveryAttempts`, `lastError`, `deliveredAt`).

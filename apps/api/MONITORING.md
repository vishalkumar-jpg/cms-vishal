# Monitoring hub (`modules/monitoring`)

Backlog #29 (CRM delivery status) + #37 (runtime error capture) + #30 (page
audits / certification). Site-scoped (`@Roles("site_admin")`) except the
`@Public` error-ingest endpoint. Mounted at `/api/v1/monitoring`.

The three reads/mutations go through `ScopedRepository` (hard tenant predicate);
mutations are audited (`category: "monitoring"`).

---

## 1. CRM-sync monitoring (#29)

**There is NO `crm_sync_log` table in this codebase.** The forms→CRM delivery
log IS the `form_submissions` table (`forms.schema.ts`). Its delivery
state-machine columns are the sync log:

- `status` ∈ `stored | delivering | delivered | failed | dead_lettered`
- `deliveryAttempts`, `lastError`, `deliveredAt`, `createdAt`

The worker (`apps/worker/src/processors/crm-delivery.processor.ts`) advances
those columns. We only **read** them and offer a **retry**.

- `GET /api/v1/monitoring/crm-deliveries?status=&limit=&offset=` — site's rows,
  newest first. Returns a safe projection (no raw lead `data`/`meta` PII).
- `POST /api/v1/monitoring/crm-deliveries/:id/retry` — resets the row to `stored`
  and **re-enqueues the existing delivery job** via
  `QueueService.enqueueCrmDelivery(...)` (queue `crm-delivery`, job `deliver`).
  We never reimplement delivery — the worker remains the source of truth and its
  idempotency check (`status === "delivered"` → no-op) protects against dupes.

---

## 2. Runtime error capture (#37)

Table `runtime_errors` (`monitoring.schema.ts`): `siteId, source, message,
stack, url, userAgent, count, firstSeen, lastSeen`. **Deduped** by
`(siteId, source, message, url)` — a repeat increments `count` + bumps
`lastSeen` instead of inserting a new row.

### Ingest contract (`@Public`, host-resolved, rate-limited)

```
POST /api/v1/monitoring/errors
Headers: (the renderer/CDN forwards the visitor host as x-forwarded-host)
Body (application/json):
  {
    "message": "TypeError: Cannot read properties of undefined",  // required, <=2000
    "stack":   "…optional, <=8000",
    "url":     "https://site.example/pricing",                    // optional
    "source":  "renderer" | "admin" | "api"                       // optional, default "renderer"
  }
Response: 202 { "deduped": boolean, "id": string | null }
```

- The site is resolved server-side from the `Host` / `x-forwarded-host` header
  via `SiteResolver` (the same resolver the public render API uses). A
  client-supplied siteId is never trusted. Unknown host → `{deduped:false,id:null}`
  (silently dropped, never an error to the client).
- Rate-limited per-IP (reuses the `form` bucket; bucket name
  `monitoring-ingest`) so a runaway client can't flood the table.

`GET /api/v1/monitoring/errors?source=&limit=&offset=` lists captured errors for
the active site (site-scoped), most-recently-seen first.

### One-line client hook to wire (renderer or admin)

```ts
// Report uncaught errors to the monitoring ingest (fire-and-forget).
window.addEventListener("error", (e) => {
  fetch(`${API_URL}/api/v1/monitoring/errors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: e.message,
      stack: e.error?.stack,
      url: location.href,
      source: "renderer", // or "admin"
    }),
    keepalive: true,
  }).catch(() => {});
});
// (Optionally also listen for "unhandledrejection".)
```

The renderer forwards the visitor host via `x-forwarded-host`; an in-browser
`fetch` to the API origin already carries the correct `Host`.

---

## 3. Page audits / certification (#30) — real Lighthouse

Table `page_audits` (`monitoring.schema.ts`): `siteId, pageId, path, status,
performanceScore, accessibilityScore, seoScore, bestPracticesScore, lcp, cls,
ranAt`. Scores are 0..100 (Lighthouse scale); `lcp` in ms, `cls` unitless.

- `GET /api/v1/monitoring/audits?path=&limit=&offset=` — list, newest first.
- `POST /api/v1/monitoring/audits/run { path, pageId? }` — inserts a row with
  `status: "pending"` (null scores), resolves the site's public URL for `path`,
  and **enqueues** a `page-audit` job (`QueueService.enqueuePageAudit`). The
  worker runs a **real Lighthouse** audit and overwrites the row with real
  0..100 scores + LCP/CLS (`status: "completed"`), or marks it `skipped` with a
  clear message when no headless Chromium is available — it never crashes.

The seam is gone. See **apps/api/PAGE-AUDITS-LIGHTHOUSE.md** for the full
queue/flow, the Lighthouse categories + extracted metrics, the URL construction,
and the Chromium / `CHROME_PATH` requirement + guard. The admin tab renders
score cards from whatever the row holds — `pending` → `completed`/`skipped`
needs no UI change.

---

## Admin surface

`apps/admin/src/views/monitoring/` — one route `/monitoring`, one sidebar entry
"Monitoring" under **Site**. Three tabs: **CRM deliveries** (table + status
filter + retry), **Runtime errors** (grouped cards by message with counts +
last/first seen), **Page audits** (per-path score cards + "Run audit" seam
button + a placeholder banner). Wrapped hooks in `hooks/useMonitoring.ts`,
query keys `CRM_DELIVERIES` / `RUNTIME_ERRORS` / `PAGE_AUDITS`.

## Migration

`0016_monitoring.sql` (journal idx 16) creates `runtime_errors` + `page_audits`
(both `IF NOT EXISTS`, FK to `sites` ON DELETE CASCADE, site-scoped indexes).

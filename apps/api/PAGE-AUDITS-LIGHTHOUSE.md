# Page audits — real Lighthouse (#30)

Replaces the old page-audit **seam** (`status:"seam"` placeholder rows) with a
real **Lighthouse** run in the worker, guarded on Chromium availability the same
way `sharp` (image-process) and `pg_dump` (backups) are guarded — so it degrades
cleanly where a headless Chrome isn't installed and **never crashes the worker**.

## Flow

```
POST /api/monitoring/audits/run { path, pageId? }   (site_admin, site-scoped)
        │
        ├─ resolve the site's public URL for `path`  (MonitoringService.resolveAuditUrl)
        ├─ INSERT page_audits row  status:"pending"  (scores null, ranAt=now)
        └─ QueueService.enqueuePageAudit({ auditId, siteId, path, url })
                │   queue "page-audit", job "run", jobId `page-audit:<auditId>`, attempts:1
                ▼
        worker  page-audit.processor.ts  (concurrency 1)
                ├─ WITH Chromium  → UPDATE row status:"completed" + real 0..100 scores + LCP/CLS + ranAt
                └─ WITHOUT/failed → UPDATE row status:"skipped"   + clear message (worker stays alive)

GET /api/monitoring/audits  → unchanged; the admin Monitoring UI renders the row/scores/status.
```

Only ids + the pre-resolved `url` travel through Redis. Postgres (`page_audits`)
is the source of truth — the worker loads the row by `auditId` and overwrites it.

## Queue plumbing

- API: `QUEUE_NAMES.PAGE_AUDIT` + `PAGE_AUDIT_JOBS.RUN` + `PageAuditJob` payload
  (`queue.constants.ts`); `QueueService.enqueuePageAudit(...)` producer
  (`queue.service.ts`); registered in `queue.module.ts`.
- Worker: `QUEUE_NAMES.PAGE_AUDIT` + `PAGE_AUDIT_JOBS` (`queue-names.ts`);
  `Worker` registered in `worker.ts` (concurrency 1) → `processPageAudit`.

## URL construction (`resolveAuditUrl`)

Prefer the site's configured domain, in order:

1. `site.primaryDomain` or `site.customDomain` → `https://<domain><path>`.
2. else `PLATFORM_BASE_DOMAIN` set → `https://<subdomain>.<PLATFORM_BASE_DOMAIN><path>`.
3. else local/dev fallback → `AUDIT_BASE_URL` (preferred), else `RENDERER_BASE_URL`,
   else `RENDERER_INTERNAL_URL`, else `http://localhost:3000`. Loopback hosts are
   rewritten to `http://<subdomain>.localhost:<port><path>` so Chrome navigates
   the tenant host without a Host-header override (avoids `CHROME_INTERSTITIAL_ERROR`).
   Do **not** point this at the admin SPA (`:5001`).

`path` is normalized to a leading `/`.

## Lighthouse run

- Guarded dynamic `import()` of **`lighthouse`** + **`chrome-launcher`** (added to
  `apps/worker/package.json` deps).
- `chrome-launcher` finds a system Chrome/Chromium; `CHROME_PATH` env overrides
  the binary. Chrome is launched headless (`--headless=new --no-sandbox
  --disable-gpu`), Lighthouse runs against `url` with `onlyCategories`:
  **performance, accessibility, seo, best-practices** (mobile form factor).
- Extracted + written to the row:
  - four category scores scaled `0..1` → **0..100** integers
    (`performanceScore`, `accessibilityScore`, `seoScore`, `bestPracticesScore`),
  - **LCP** = `audits["largest-contentful-paint"].numericValue` (ms),
  - **CLS** = `audits["cumulative-layout-shift"].numericValue` (unitless),
  - `status:"completed"`, `ranAt`.

## Chromium requirement + guard (CRITICAL)

For **real** audits the worker container needs a headless Chrome/Chromium plus
the Lighthouse deps:

```
cd apps/worker && bun add lighthouse chrome-launcher
# + a headless Chrome/Chromium on PATH, or CHROME_PATH=/path/to/chrome
# optional: PAGE_AUDIT_TIMEOUT_MS (default 60000)
```

The whole run is **guarded** (mirrors `sharp`/`pg_dump`): the row is marked
`skipped` with a clear message — *"Chromium not available — install a headless
Chrome + set CHROME_PATH …"* — and the worker does **NOT** crash when:

- `lighthouse` / `chrome-launcher` isn't installed, **or**
- no Chrome binary is found, **or**
- the launch/navigation throws, **or**
- the run exceeds `RUN_TIMEOUT_MS` (60s default, timeout-guarded).

`attempts: 1` on the job (no BullMQ retry storm). The admin Monitoring UI shows
the `skipped`/`completed` status either way, so the surface stays functional
without Chromium.

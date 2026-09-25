# Site-health: broken-link checker + SSL/domain-expiry monitoring

Two site-health features, mounted on the existing **monitoring** and **domains**
modules (both already registered). Migration `0030_site_health.sql` (journal idx
30). Everything is guarded end-to-end — a broken/unreachable link or an
unreachable `:443` is **recorded**, never crashes the worker.

---

## 1. Broken-link checker

### Flow
`POST /api/monitoring/links/check` (`@Roles("contributor")`, site-scoped) inserts
a `running` `link_checks` row, resolves the site's public **base URL + Host**
(primary/custom domain → `https://<domain>`; else `<subdomain>.<PLATFORM_BASE_DOMAIN>`;
else `RENDERER_BASE_URL`, default `http://localhost:3000`, with a
`<subdomain>.localhost` Host), and enqueues a `link-check` job.

The worker (`apps/worker/src/processors/link-check.processor.ts`, concurrency 1):
1. loads the site's `status='published'` pages → paths (`index`/`home` → `/`),
2. fetches each page's HTML from the renderer (host-resolved via the Host header),
3. extracts `<a href>` with a tolerant regex; classifies each target against the
   base (`internal` vs `external`), skipping `mailto:/tel:/javascript:/data:/#`
   and stripping fragments; dedupes into a unique-target map,
4. probes each unique target — **HEAD**, falling back to **GET** on 405/501 —
   with bounded concurrency + a short timeout, recording every non-2xx/3xx (and
   `timeout`/`dns`/`error`) onto `broken_links`,
5. writes the run summary (`pagesCrawled`/`linksChecked`/`brokenCount`) +
   `completed` (or `failed` with a `detail` on an unexpected error).

### Crawl scope / limits (env-overridable)
`LINK_CHECK_MAX_PAGES=50`, `LINK_CHECK_MAX_LINKS=300`, `LINK_CHECK_CONCURRENCY=8`,
`LINK_CHECK_TIMEOUT_MS=8000`. Internal probes carry the tenant Host; external
probes do not. In a sandbox where hosts are unreachable, the run still completes
and targets are simply recorded as `dns`/`timeout`/`error` — the mechanism +
no-crash is what's verified.

### Read
`GET /api/monitoring/links` (`@Roles("contributor")`) → the **latest** run
(`run`) + its `broken_links` (`broken`) + paging. `run: null` when never run.

### Schemas
- `link_checks` (prefix `lkc`): `siteId, status(running|completed|failed),
  pagesCrawled, linksChecked, brokenCount, detail, startedAt, finishedAt`.
- `broken_links` (prefix `blk`): `siteId, runId, sourcePath, targetUrl,
  kind(internal|external), status(httpStatus|timeout|dns|error), checkedAt`.

### Admin
Monitoring → **Broken links** tab: a summary line (status · pages · links ·
broken · when), a **Run check** button, and a table (source page → broken URL,
kind, status).

---

## 2. SSL / domain-expiry monitoring

### Flow
The `site_domains` row gains `tlsExpiresAt`, `tlsCheckedAt`, `tlsCheckError`.
A worker (`apps/worker/src/processors/ssl-check.processor.ts`, concurrency 1)
runs on a **daily repeatable sweep** (`SSL_CHECK_CRON`, default `0 4 * * *`) over
**all verified domains**, and on demand for one domain via
`POST /api/domains/:id/ssl-check` (`@Roles("site_admin")`).

For each domain it opens a TLS socket to `<domain>:443`
(`servername` set, `rejectUnauthorized:false` so an expired/self-signed cert
still yields its date), reads the peer cert `valid_to` and stores it as
`tlsExpiresAt` (clearing `tlsCheckError`). **Guards:** DNS failure → `dns`,
handshake timeout → `timeout`, no/unparseable cert → `no-cert`, else `error` —
recorded on `tlsCheckError`, socket always destroyed, worker never crashes.
`SSL_CHECK_TIMEOUT_MS=8000`.

### API
`GET /api/domains` now returns each row enriched with a **computed** `certStatus`
+ `daysToExpiry`: `ok` (≥30d), `expiring-soon` (<30d), `expired` (past),
`error` (probe failed, no expiry), `unknown` (never checked).

### Admin
Domains table gains an **SSL cert** column with a badge — "SSL valid · expires
in N days" / "⚠ Expires in N days" / "✗ Expired" / "Check failed (reason)" /
"Not checked" — plus a **Re-check SSL cert** row action.

---

## Queues
`LINK_CHECK` (`link-check`, jobs `run`) and `SSL_CHECK` (`ssl-check`, jobs
`run`/`sweep`) registered in `queue.module.ts` + mirrored in the worker's
`queue-names.ts`; producers `enqueueLinkCheck` / `enqueueSslCheck` on
`QueueService`. Both single-attempt (self-guarded, no BullMQ retry storms).

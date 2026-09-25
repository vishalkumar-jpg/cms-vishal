# Analytics Pipeline (Phase 2a)

First-party, privacy-friendly product analytics for OB-CMS: **tracking → ingest
→ hourly rollup → a fast, site-scoped stats API**. Built to feed the admin
analytics dashboards (which consume the exact stats contract below).

## Data flow

```
renderer <Analytics/>  ──sendBeacon──▶  /collect (renderer proxy, same-origin)
                                             │ forwards Host + JSON
                                             ▼
                          POST /api/collect  (@Public, host-resolved, rate-limited)
                                             │ bulk insert (no PII)
                                             ▼
                                    analytics_events  (raw, TTL-friendly)
                                             │
                       worker hourly rollup (BullMQ repeatable, idempotent upsert)
                                             ▼
                                    analytics_daily   (per site/day/path rollup)
                                             │
                          GET /api/analytics/*  (@Roles("contributor"), site-scoped)
```

## Event model

`analytics_events` (prefix `aev`) — one row per beacon. No PII, no IP, no
cross-site identifiers.

| column | notes |
| --- | --- |
| `siteId` | tenant, resolved server-side from the Host header (never trusted from the client) |
| `ts` | server receipt time |
| `type` | `pageview` \| `web-vitals` \| `event` |
| `path` | request path, query string + hash stripped |
| `referrer` | `document.referrer` |
| `source` | derived channel: `direct` \| `organic` \| `referral` \| `social` \| `campaign` |
| `medium`, `campaign` | from UTM params |
| `visitorId` | random first-party id (localStorage), NOT a cross-site cookie |
| `sessionId` | random id, 30-min inactivity window (client-derived) |
| `deviceType` | `desktop` \| `mobile` \| `tablet` |
| `metric`, `value` | Core Web Vitals (`LCP`/`CLS`/`INP`) for `type=web-vitals` |
| `name` | optional custom-event name |

`source` derivation: UTM (`utm_source`/`utm_medium`) ⇒ `campaign`; else classify
the referrer host — known social hosts ⇒ `social`, known search engines ⇒
`organic`, any other host ⇒ `referral`, no referrer ⇒ `direct`.

`analytics_daily` (prefix `adl`) — per-`(siteId, day, path)` rollup with a unique
index on `(site_id, day, path)`: `pageviews`, `visitors` (distinct), `sessions`
(distinct), `sessionSeconds`, `bouncedSessions`, and `sources`/`devices` jsonb
count maps (channel/device → distinct-visitor count).

## Ingest

`POST /api/collect` — `@Public`, host-resolved via `@PublicHost` + `SiteResolver`,
rate-limited (`analytics-collect` bucket, per-IP). Body:

```jsonc
{ "events": [ { "type": "pageview", "path": "/pricing", "referrer": "...",
  "utm": { "source": "...", "medium": "...", "campaign": "..." },
  "visitorId": "...", "sessionId": "...", "screenW": 1440, "screenH": 900,
  "deviceType": "desktop", "metric": "LCP", "value": 1234, "name": "..." } ] }
```

Returns **204** (fire-and-forget). Up to 50 events per batch are bulk-inserted.
Unknown host ⇒ silently dropped (0 accepted) so a bad Host never errors clients.

## Rollup

Worker `analytics-rollup` queue, a **repeatable hourly** job (cron `0 * * * *`,
override `ANALYTICS_ROLLUP_CRON`). Re-aggregates the last
`ANALYTICS_ROLLUP_LOOKBACK_HOURS` (default 48h) of `pageview` events per
`(site, day, path)` and **upserts** `analytics_daily` (`ON CONFLICT … DO UPDATE`
with absolute recomputed values) — idempotent, safe to re-run. Web-vitals stay
in raw events and are queried with percentiles by the stats API.

## Stats API contract (site-scoped, `@Roles("contributor")`, default last 28 days)

- `GET /api/analytics/overview?from&to` → `{ visitors, pageviews, avgSessionSec, bounceRate (0..1), prev:{visitors,pageviews} }`
- `GET /api/analytics/timeseries?from&to&interval=day` → `Array<{ date:"YYYY-MM-DD", visitors, pageviews }>` (dense — zero-filled)
- `GET /api/analytics/pages?from&to&limit=20` → `Array<{ path, pageviews, visitors }>`
- `GET /api/analytics/sources?from&to` → `Array<{ source, visitors }>`
- `GET /api/analytics/devices?from&to` → `Array<{ device:"desktop"|"mobile"|"tablet", visitors }>`
- `GET /api/analytics/web-vitals?from&to` → `{ lcp:{p75,good,ni,poor}, cls:{…}, inp:{…} }`

Web-vitals buckets use WCAG-style thresholds: LCP 2500/4000 ms, CLS 0.1/0.25,
INP 200/500 ms; `p75` is the 75th-percentile value. All reads go through
`ScopedRepository` (site + soft-delete predicate) — no cross-tenant leak.

## Privacy stance

- First-party only: `visitorId` is a random localStorage value, never a
  cross-site cookie; no fingerprinting, no PII, no IP stored.
- Renderer tracker honors **Do-Not-Track** and an `enabled` flag — sends nothing
  when opted out.
- Paths are captured without query strings; UTM channel attribution only.
- Raw events are TTL-friendly (aggregated into `analytics_daily`); the rollup is
  the durable, query-fast source for the dashboards.

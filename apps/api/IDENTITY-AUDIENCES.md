# Identity & Audiences (Phase 3)

The B2B intelligence layer over the Phase-2 analytics stream. It turns anonymous
first-party pageviews into **visitor profiles**, resolves them to **identities**
(known emails) and **companies** (by email domain), applies **lead scoring**, and
groups them into **audiences** (segments). All data is tenant-private (every
table has a `site_id` FK, cascade on site delete, and all reads/writes go through
`ScopedRepository` so there is no cross-tenant leak).

```
analytics_events ──(worker: profile-rebuild)──▶ visitor_profiles ──(scoring)──▶ score
       │                                              ▲
  identify (email)                                    │ identityId
       ▼                                              │
   identities ──(business domain)──▶ companies        │
                                                       │
audience_definitions ──(worker: audience-recompute)──▶ audience_memberships
```

## Data model

- **`visitor_profiles`** (`vpr`) — one row per first-party `visitorId`
  (`siteId, visitorId` unique). Aggregated from `analytics_events` by the
  worker: `firstSeen/lastSeen`, `sessions`, `pageviews`, `lastSource`,
  `lastDevice`, `topPaths` (jsonb `[{path,views}]`), `identityId` (nullable),
  `score`.
- **`identities`** (`idt`) — a known person, keyed by `primaryEmail`
  (`siteId, primaryEmail` unique). Optional `name`, optional `companyId`.
- **`companies`** (`cmp`) — a B2B account by email `domain`
  (`siteId, domain` unique). `name/industry/size` are the **enrichment seam**
  (nullable — see below).
- **`scoring_rules`** (`scr`) — `name`, a single `condition {field, op, value}`,
  `points`, `active`. The recompute sums the points of every matching active
  rule → the profile `score`.
- **`audience_definitions`** (`aud`) — `name`, `description`, `rules` (a jsonb
  AND/OR condition group over the same fields).
- **`audience_memberships`** (`ame`) — materialized `(audienceId,
  visitorProfileId)` rows (unique), rebuilt by the recompute job.

Migration: `0024_identity_audiences.sql` (idempotent `IF NOT EXISTS` / duplicate-safe).

## Identity resolution & the identify path

`linkEmail(siteId, visitorId, email, name?)` (in `IdentityService`) is the core
primitive:

1. **Company ID by domain** — if the email domain is a **business** domain (not
   gmail/outlook/yahoo/… — see `FREE_EMAIL_DOMAINS` in `identity/rules.ts`),
   upsert a `company` by `(site, domain)`.
2. **Identity upsert** — upsert an `identity` by `(site, email)`, linking the
   company.
3. **Profile link** — upsert `visitor_profiles.identityId` for `(site,
   visitorId)` (creates a stub profile if the rebuild hasn't run yet, so the link
   survives).

It is reached two ways:

- **`POST /api/identify`** — a `@Public`, host-resolved, ip-rate-limited beacon
  `{ visitorId, email, name? }`. Returns 204 (fire-and-forget). The renderer
  exposes a same-origin `/identify` proxy (mirrors `/collect`) that forwards the
  tenant Host. This keeps the PII-free invariant of `analytics_events` intact —
  emails live only in `identities`, never in the analytics stream.
- **Forms submit hook** — `PublicFormsService.submit` best-effort calls
  `linkEmail(...)` inside its existing non-spam fan-out block when the form has an
  `email` field and the submit carried a `visitorId`. The renderer form provider
  now includes `localStorage["ob_vid"]` (the analytics visitor id) in the submit
  body; the `SubmitFormDto` gained an optional `visitorId`. The hook is fully
  tolerant of a missing visitorId (the tenant-isolation submit test sends none),
  never throws, and never changes the submit result.

## Lead scoring & recompute (worker)

`profile-rebuild` (queue `profile-rebuild`, job payload `{ siteId }`,
`enqueueProfileRebuild`) — for the site, aggregates the last
`PROFILE_REBUILD_LOOKBACK_HOURS` (default 720h) of `analytics_events` per
`visitorId` into `visitor_profiles` (idempotent upsert, **preserving** any linked
`identityId`), then applies the site's active `scoring_rules`: a `ProfileView`
(pageviews, sessions, source, device, isIdentified, hasCompany, visitedPath,
email, companyDomain) is evaluated against each rule's condition (operators
`eq/neq/gte/lte/gt/lt/contains/isTrue/isFalse`) and matching points are summed
into `score`. Triggered by `POST /identity/rebuild`.

## Audience rules & recompute (worker)

An audience `rules` is an AND/OR group over the same `ProfileView` fields.
`POST /audiences/preview` evaluates a rule set **in-process** against the current
profiles for an instant match count. `audience-recompute` (queue
`audience-recompute`, payload `{ siteId, audienceId? }`, `enqueueAudienceRecompute`)
evaluates the definition(s) and rewrites `audience_memberships` via
delete-all-then-insert per audience (idempotent). The rule-evaluation logic lives
in `identity/rules.ts` (API) and is mirrored verbatim in the worker
(`apps/worker/src/db/rules.ts`) — keep them in sync.

## API (site-scoped, contributor read / editor write, responseUtils, audited)

- **Identity**: `GET /identity/visitors` (list; `sort=score|lastSeen|pageviews`,
  `identified`), `GET /identity/visitors/:id` (360: profile, identity, company,
  top paths, event timeline), `GET /identity/identities`,
  `GET /identity/companies`, `GET /identity/rule-fields`, scoring-rules CRUD
  (`/identity/scoring-rules`), `POST /identity/rebuild`.
- **Audiences**: CRUD `/audiences`, `POST /audiences/preview`,
  `GET /audiences/:id/members`, `POST /audiences/:id/recompute`.
- **Public**: `POST /api/identify`.

Both modules are registered in `app.module.ts`.

## Admin

Under the sidebar **Insights** group:

- **Identity** (`/identity`) — a tabbed center: **Visitors** table (score,
  sessions, pageviews, source, identified badge) with a **Visitor 360** drawer
  (stat cards, identity + company, top paths, event timeline); **Identities** and
  **Companies** lists; a **Scoring rules** editor (field/op/value + points). A
  "Rebuild profiles" action enqueues the recompute.
- **Audiences** (`/audiences`) — list with member counts; an editor that reuses
  the shared `RuleBuilder` (AND/OR tree) with a **live preview count**; a
  **Members** drawer; per-audience recompute. The `rule-adapter.ts` converts
  between the RuleBuilder's editor model and the API rule shape (the forms
  adapter is not reused — it flattens to a single condition).

## Enrichment seam

`companies.industry` and `companies.size` are intentionally **nullable** and are
never populated by an external API here. To enrich, add a worker step (or a
company-enrichment job) that, for a company `domain`, calls a provider
(Clearbit / Apollo / Clay / etc.) and updates the row. The admin Companies list
already renders these fields (showing an "enrichment seam" hint when absent), so
enrichment is purely additive — no schema or UI change required.

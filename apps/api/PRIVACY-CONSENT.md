# Privacy & Consent (GDPR / ePrivacy)

The compliance capstone that makes the Phase 2–5 tracking layer legally
shippable: a Consent Management Platform (CMP) that GATES every tracker, a DSAR
engine (find / export / erase across all tables), and per-site data retention.

---

## 1. Consent model

### The `ob_consent` cookie (first-party, ~6 months, `SameSite=Lax`)

```jsonc
{ "analytics": true, "marketing": false, "ts": 1720000000000, "version": "1" }
```

Categories:

| Category    | Always on | Cookie flag  | What it gates |
|-------------|-----------|--------------|---------------|
| necessary   | ✅ yes    | —            | site function; never gated |
| analytics   | no        | `analytics`  | Phase 2 pageviews/web-vitals, Phase 4 experiments, Phase 5 attribution |
| marketing   | no        | `marketing`  | Phase 3 identity resolution (email→visitor linking) |

- Managed entirely client-side by `apps/renderer/src/lib/consent.ts` — a tiny,
  SSR-safe pub-sub over the cookie. It is THE gate every tracker reads.
- A new `policyVersion` (from site config) invalidates an older decision ⇒ the
  banner re-prompts.
- **DNT** (`navigator.doNotTrack`) ⇒ an automatic **reject** persisted once, so a
  DNT visitor is never prompted and never tracked.
- Before any decision the state is "unknown" ⇒ everything is treated as denied
  (necessary-only). No `ob_vid`, no beacons.

### UI

`apps/renderer/src/components/consent-manager.tsx` (`"use client"`, mounted once
per page): a first-visit **banner** (Accept all / Reject / Customize) + a
**preference-center** (per-category toggles, necessary locked on). Renders
`null` on the server and until mount (no flash-of-content). A **"Manage cookies"**
link in the footer (`data-ob-cookie-settings`, a plain server-rendered anchor)
re-opens the center via a delegated click handler registered by the manager.

### Config (per-site, published on `/api/v1/public/site`)

Stored as `site_settings.consent` (jsonb). Fields: `enabled`, `mode`
(`all` | `eu`), `position`, `policyVersion`, `policyUrl`, `title`, `message`,
`analyticsDescription`, `marketingDescription`, `accentColor`. Edited in the
admin **Settings → Privacy & Consent** tab (`@Roles("site_admin")`, audited,
save = live cache purge). When `enabled` is false (or unset) the renderer shows
NO banner and trackers keep their prior behaviour (**no regression**).

---

## 2. Tracker gating map (which trackers, and how)

The **master gate** is `analytics.tsx` — it is the ONLY component that MINTS
`ob_vid` (localStorage + cookie). Gating it there transitively silences the
experiment + attribution trackers, which only READ `ob_vid` and no-op without it.

| Tracker (file) | Phase | Category | How it's gated |
|---|---|---|---|
| `components/analytics.tsx` — pageview + web-vitals + `ob_vid` mint | 2 | analytics | explicit `hasConsent("analytics")` gate in the mount effect; re-checks on consent change (`onConsentChange`). No consent ⇒ **no `ob_vid`, no beacons**. |
| `packages/blocks/src/blocks/experiment.tsx` — exposure/assignment + `ob_ab` | 4 | analytics | **transitively**: reads `ob_vid` (localStorage / server cookie); with no `ob_vid` it renders the control variant and fires NO exposure. Not edited (off-limits package). |
| `components/experiment-goals.tsx` — A/B conversion beacon | 4 | analytics | explicit `hasConsent("analytics")` gate + transitive (no `ob_ab`/`ob_vid`). |
| `components/form-provider.tsx` — identity resolution (`visitorId` in submit) | 3 | marketing | the submit attaches `visitorId` ONLY when `hasConsent("marketing")`. The form still submits (necessary) — just without the tracking link. |
| Attribution conversion beacons | 5 | analytics | server-derived from `analytics_events`; the client conversion beacon is `experiment-goals.tsx` (gated above). No `ob_vid` ⇒ nothing to attribute. |

`page.tsx` passes `consentEnabled` (from `site.consent.enabled`) + `policyVersion`
to `<Analytics>`, `<ExperimentGoals>` and `<LiveFormProvider>`; when the banner
is off, `consentEnabled=false` and the gates are inert (DNT-only, as before).
The catch-all, blog-post, and collection-item routes all mount the banner.

**Geo `mode`**: `all` shows the banner to everyone (safe default). `eu` is an
**IP-geo SEAM** — the renderer can't know the visitor's country client-side, so
it currently behaves like `all`; a future edge/middleware `data-ob-geo` header
would narrow it to EU visitors.

---

## 3. Proof-of-consent log

`@Public POST /api/v1/consent` (host-resolved, best-effort) → a `consent_records`
row `{ siteId, visitorId?, analytics, marketing, method, policyVersion, ipHash,
meta }`. The IP is stored as a **SHA-256 hash only** (never raw). The banner
beacons every decision here via the same-origin **`/api/consent` browser proxy**
(forwarding to `/api/v1/consent` upstream). The cookie
remains the live gate; this table is the durable GDPR Art. 7(1) audit trail.
Admin sees recent records in **Data requests** and via
`GET /api/v1/sites/:siteId/consent/records`.

---

## 4. DSAR (Data Subject Access Request)

Module `apps/api/src/modules/privacy`. All routes `@Roles("site_admin")`,
site-scoped via `ScopedRepository` (X-Site-Id), erasure audited
(`privacy.dsar_erased`).

| Endpoint | Result |
|---|---|
| `GET /api/v1/privacy/subject?query=<email\|visitorId>` | per-table counts + resolved identity |
| `GET /api/v1/privacy/subject/export?query=` | full JSON of every held row |
| `DELETE /api/v1/privacy/subject?query=` | erase/anonymize across all tables (audited) |

**Subject resolution**: a `query` containing `@` is an email → resolves
`identities.primaryEmail` → `identityIds` → all linked `visitorIds` (via
`visitor_profiles`). A `visitorId` also picks up its linked identity + that
identity's other visitors (a request from one device erases the person).

**Cross-table erasure** (all scoped to the site):

| Table | Keyed by | Action |
|---|---|---|
| `analytics_events` (incl. exposure/conversion) | visitorId | DELETE |
| `attribution_conversions` | visitorId ∨ identityId | DELETE |
| `audience_memberships` | visitorId ∨ identityId | DELETE |
| `consent_records` | visitorId | DELETE |
| `form_submissions` | email in `data` jsonb | DELETE |
| `visitor_profiles` | visitorId ∨ identityId | DELETE |
| `identities` | identityId | **anonymize** (email→`erased+<id>@dsar.invalid`, name→null) |
| `companies` | referenced by identity | exported; not deleted (shared account) |

Identities are anonymized (not deleted) so dependent FKs degrade gracefully and
the unique `(site, email)` index stays valid.

Admin screen: **Data requests** (`/privacy`, sidebar under Site) — a lookup box
→ summary → **Export JSON** (client download) + **Erase/anonymize** (typed
`ERASE` confirm), plus recent DSAR actions (from the audit log) and recent
consent decisions.

---

## 5. Data retention

Per-site `site_settings.retention` (jsonb): `rawEventRetentionDays` (default
400), `piiRetentionDays` (0 = never). Edited in the admin Privacy tab.

Worker job `apps/worker/src/processors/retention-purge.processor.ts`, registered
on the `retention-purge` queue as a **daily repeatable** cron
(`RETENTION_PURGE_CRON`, default `0 3 * * *`). Per site it:

1. hard-deletes `analytics_events` older than `rawEventRetentionDays` (the daily
   rollup already aggregated them into `analytics_daily`, so dashboards are
   unaffected);
2. when `piiRetentionDays > 0`, anonymizes `identities` not seen (via their
   newest profile `lastSeen`) for that window.

Idempotent (re-running deletes nothing new), logged, and never throws (a bad site
is logged + skipped). A global fallback comes from `RAW_EVENT_RETENTION_DAYS`.

---

## 6. Stance summary

- **DNT** → auto-reject (never prompt, never track).
- **Geo** → `all` by default; `eu` documented as an IP-geo seam.
- **No consent** → necessary-only: no `ob_vid`, no beacons, no rows created.
- **Consent change** → trackers re-check live (accept later ⇒ tracking starts).
- **Back-compat** → banner disabled ⇒ zero behavioural change to existing sites.

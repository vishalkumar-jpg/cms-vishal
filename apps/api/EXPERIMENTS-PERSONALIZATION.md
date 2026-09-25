# Personalization + A/B Testing (Phase 4)

Audience-targeted content + on-page A/B experiments with a deterministic sticky
traffic split and conversion tracking. Built ON TOP OF Phase 2 (analytics stream)
+ Phase 3 (audiences) + the builder's conditional-visibility — no new data path
was added for tracking; exposures/conversions ride the existing `/collect` beacon.

```
audience_memberships ──(visibleIf: audience)──▶ renderer env.audiences ──▶ block shown/hidden
experiments + experiment_variants ──(deterministic split)──▶ Experiment block renders 1 variant
        │                                                            │ exposure beacon
        │                                                            ▼
        └──── GET /experiments/:id/results ◀── analytics_events (name=exposure|conversion, experimentId, variant)
```

## 1. Personalization — audience-targeted visibility

The node-level `visibleIf` (Phase 3, `@ob-cms/block-schema/binding.ts`) gained an
`audience` condition:

```ts
visibleIf: { type: "audience", audienceId: string, audienceOp?: "in" | "not-in" }
```

`evaluateVisibleIf` (the single PURE choke-point used by BOTH the renderer's
hook-free walker and the editor) resolves it against `ctx.audiences` — the set of
audience ids the visitor belongs to. `in` → show iff the visitor is a member;
`not-in` → show iff not. Missing `audienceId` is a no-op (always visible); an
absent visitor set = empty (an `in` fails, a `not-in` passes). Blocks WITHOUT a
`visibleIf` are byte-identical to before (`evaluateVisibleIf(undefined) === true`,
no extra markup).

### How the visitor's audiences are resolved at render

`ob_vid` (the analytics visitor id) lives in `localStorage` (client-only). To
gate blocks **server-side** (SSR, no flash for returning visitors), the analytics
tracker now **mirrors `ob_vid` into a first-party `ob_vid` cookie** (SameSite=Lax,
~1y, same random id — no new PII). The renderer page (`app/[[...slug]]/page.tsx`)
reads that cookie (`cookies()`), calls the `@Public`, host-resolved
`GET /api/experiments/personalize/audiences?visitorId=` endpoint (via the
same-origin proxy `app/api/experiments/personalize/audiences/route.ts`), and
passes the resolved set as `env.audiences` into `RenderLayout`. That endpoint
reads the materialized `audience_memberships` (site-scoped, joined to live
`audience_definitions`) by `visitorId` — the membership table already
denormalizes `visitorId`, so no profile join is needed. Reading the cookie opts
the page into per-request dynamic rendering (personalized output is not
shared-cached), which is correct for targeted content. A brand-new visitor's very
first request has no cookie yet → empty set; membership takes effect on the next
navigation once the cookie is set.

Editor: `VisibilityControl` (Content tab) gained a "🎯 For audience…" option — an
`in`/`not-in` selector + a dropdown of the site's audiences (`useAudiences`). The
editor NEVER truly hides the node (`env.editor` short-circuits the walker's
removal), so authors keep editing; the audience condition rides inside the same
`visibleIf` object and is hoisted by `craft/serialize.ts` unchanged.

## 2. A/B experiments — data model

- **`experiments`** (`exp`): `siteId, name, description, pageId?, status
  (draft|running|paused|done), goalType (pageview|click|form_submit), goalPath?,
  startedAt?, winnerVariantId?`.
- **`experiment_variants`** (`evr`): `experimentId, key ("A"/"B"/…), name, weight
  (positive int), isControl`. Unique `(experimentId, key)`.
- **Exposures + conversions** are NOT new tables — they are recorded on
  `analytics_events` (Phase 2) as `type="event"` with `name="exposure"` /
  `name="conversion"` plus two new nullable dimension columns **`experimentId`**
  and **`variant`**. This keeps the PII-free, TTL-friendly stream intact and the
  hourly rollup (which filters `type='pageview'`) unaffected — the new rows are
  ignored by it, exactly like `web-vitals`. Results are computed ON-READ from
  these rows (no worker rollup was needed).

Migration `0025_experiments.sql` (idempotent `IF NOT EXISTS` / duplicate-safe FK
blocks; journal entry `idx:25`) creates the two tables + adds the two
`analytics_events` columns + an `(site_id, experiment_id)` index.

### Deterministic sticky assignment

A visitor's variant = `assignVariant(visitorId, experimentId, variants)`
(`@ob-cms/blocks/experiment-assign.ts`): an FNV-1a hash of `visitorId:experimentId`
→ a float in `[0,1)`, mapped through the variants' cumulative **weight** bands.
Because it's a PURE function of the visitor + experiment (no stored assignment),
recomputing on every request/page yields the SAME variant — sticky per visitor,
no assignment table. The same helper runs server-side (if `env.variants` is
pre-seeded) and client-side (the Experiment block, after mount, from
`localStorage["ob_vid"]`).

### Render path (editor↔renderer parity)

An **`Experiment`** canvas block (registered in `@ob-cms/blocks`, added to
`CANVAS_TYPES`) holds N child subtrees, one per authored variant. The node's
top-level `experiment` field (`{ experimentId, variantKeys[] }`, on
`blockNodeSchema`, hoisted via `craft/serialize.ts`) maps child index → variant
key.

- **Renderer**: the shared hook-free walker (`render-layout.tsx`) injects the
  serializable node map + variant child ids + the experiment mapping + env
  (`__data`/`__variantIds`/`__experiment`/`__env`) — plain JSON only, so nothing
  un-serializable crosses the RSC→client boundary (identical to the Repeater
  pattern). The block fetches the experiment's variant keys/weights/status from
  `GET /api/experiments/public/:id` (same-origin proxy), assigns a variant,
  renders ONLY that variant's subtree via `renderSubtree([chosenId], …)`, and
  fires ONE `exposure` beacon. A non-running experiment shows the control with no
  exposure.
- **Editor**: no `__data` → the block renders its Craft children with a variant
  switcher ("Variant A/B/…") so the author edits each subtree in place. The
  authoring panel (`ExperimentControls`, shown for a selected Experiment node)
  attaches an experiment + maps each child to a variant key.

### Conversion tracking

On exposure the block persists `{ variant, goalType, goalPath }` to
`localStorage["ob_ab"]`. A page-level `<ExperimentGoals/>` client component (mounted
beside `<Analytics/>`) reads active assignments and fires ONE `conversion` beacon
per (experiment, visitor) when the goal fires:
- `pageview` — the current path === `goalPath`.
- `click` — a click bubbles from a `[data-ab-goal]` element (optionally scoped to
  an experiment id).
- `form_submit` — a form submit (optionally `[data-ab-goal]`-scoped).
A `localStorage["ob_ab_conv"]` guard dedupes so repeat goals don't inflate the rate.
Honors Do-Not-Track.

## 3. API (`modules/experiments`, registered in `app.module.ts`)

Site-scoped (ScopedRepository), reads `@Roles("contributor")`, writes
`@Roles("editor")`, responseUtils-enveloped, audited:

- CRUD `/experiments` (variants replace the full set on create/update; at least 2,
  one control).
- `PUT /experiments/:id/status` — start (`running`, stamps `startedAt` once) /
  pause (`paused`) / stop (`done`, optional `winnerVariantId`).
- `GET /experiments/:id/results` → per-variant `{ exposures, conversions, rate,
  uplift (vs control), confidence }` + `leaderVariantId`. Counts come from
  `analytics_events` grouped by `(variant, name)` (site-scoped).
- `@Public`, host-resolved: `GET /experiments/public/:id` (variant
  keys/weights/status/goal for the block) + `GET
  /experiments/personalize/audiences?visitorId=` (visitor→audiences).

### Results statistic

`rate = conversions / exposures`. `uplift = rate/controlRate − 1`. `confidence`
is a **two-proportion z-test** vs the control using the pooled-proportion standard
error, with the standard-normal CDF approximated logistically (Φ(z) ≈
1/(1+e^(−1.702z))) — no stats dependency. It's a simple frequentist signal for the
admin (a leader call-out is shown when a variant leads by rate), not a substitute
for a full sequential test.

## 4. Admin

**Experiments** screen (sidebar → Insights → Experiments): list (status badge,
variant keys, goal), create/edit (name, goal + optional path, weighted variants
with a control radio), start/pause/stop, and a **Results** dialog (per-variant
exposure/conversion/rate bars, uplift, confidence, a 🏆 leader call-out; polls
every 15s). Section-variant experiments are authored via the builder's Experiment
block (attach the experiment + map variants in the property panel).

## Files touched (summary)

- `packages/block-schema`: `binding.ts` (audience `visibleIf` + `ctx.audiences`),
  `layout.ts` (`nodeExperimentSchema` + `node.experiment`), `block-props.ts`
  (`experimentSchema`).
- `packages/blocks`: `render-context.tsx` (`env.audiences/visitorId/variants`),
  `render-layout.tsx` (audience ctx + Experiment canvas special-case),
  `blocks/experiment.tsx`, `experiment-assign.ts`, registry.
- `apps/renderer`: page env (`lib/personalize.ts`, seam), `components/analytics.tsx`
  (cookie mirror), `components/experiment-goals.tsx`, proxies under
  `app/api/experiments/*`.
- `apps/api`: `database/schema/experiments.schema.ts` + `analytics.schema.ts`
  (dims), `modules/experiments/*`, `modules/analytics` (dto + toRow), migration
  `0025` + journal.
- `apps/worker`: `db/schema.ts` (analytics_events dims mirror).
- `apps/admin`: `views/experiments/*`, builder `VisibilityControl` (audience),
  `ExperimentControls` + `PropertyPanel`, `useNodeBinding` (experiment hooks),
  `craft/serialize.ts` (hoist), router + AppShell nav, queryKeys.
```

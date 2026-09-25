# Revenue & Orchestration (Phase 5)

The final intelligence layer over Phases 2–4: **marketing attribution** (revenue
credited across touchpoints) and a **workflow / automation engine** (trigger →
ordered actions → runs). Both are tenant-private (every table has a `site_id` FK,
cascade on site delete; all authenticated reads/writes go through
`ScopedRepository`). Migration: `0026_revenue_orchestration.sql` (idempotent
`IF NOT EXISTS` / duplicate-safe).

```
analytics_events (touchpoints) ─┐
                                ├─▶ attribution (on-read compute) ─▶ /attribution/*
attribution_conversions ────────┘

forms submit ────┐
audience-recompute (worker) ─┼─▶ workflow trigger (best-effort) ─▶ workflow_runs
profile scoring (worker) ────┘                                        │
                                          worker executor (WORKFLOW_RUN queue) ─┘
```

## 1. Attribution

### Touchpoint + conversion model
- A **touchpoint** is derived ON READ from `analytics_events`: one per
  `(visitor, session)` — the session's first pageview carries the acquisition
  `source`/`medium`/`campaign` + landing `path` + time. No new touchpoint table.
- A **conversion** is a durable `attribution_conversions` row (prefix `atc`):
  `siteId, ts, visitorId, identityId?, type, label, value (numeric revenue),
  landingPath, meta`.
- **Ingest** (backward-compatible, two ways):
  - The Phase-2 `/api/v1/collect` beacon: a `type:"event", name:"conversion"` event
    now also accepts an optional revenue `value` + `label`; the analytics service
    best-effort records an `attribution_conversions` row (never fails the beacon).
  - `POST /api/v1/attribution/collect` — a `@Public`, host-resolved conversion
    beacon `{ visitorId, value?, label?, type?, path? }` → 204 (mirrors /collect).

### Attribution models (on-read compute)
For each conversion the visitor's pre-conversion touchpoints are credited
(1 conversion + full `value`) under the model:
- **first** — 100% to the first touch.
- **last** — 100% to the last touch (default).
- **linear** — evenly split across all touches.
- **position** — U-shaped: 40% first, 40% last, 20% across the middle.

Credit is rolled up by **source / campaign / landing-page**. A conversion with no
recorded touchpoint gets a synthetic `direct` touch on its landing path so it is
still counted.

### API (site-scoped, `@Roles("contributor")`)
- `GET /api/v1/attribution/overview?from&to&model=` → `{ model, totals{conversions,
  value, touchpoints}, bySource[], byCampaign[], byLandingPage[] }` (each row
  `{ key, conversions, value }`).
- `GET /api/v1/attribution/models?from&to` → first/last/linear side-by-side (by-source +
  total revenue per model).
- `GET /api/v1/attribution/conversions?from&to` → recent conversions.

Module registered in `app.module.ts`; also imported by `AnalyticsModule` (so the
conversion beacon can record).

## 2. Workflows / automation

### Data model
- `workflows` (`wkf`) — `name`, `status` (active|paused), `trigger` jsonb
  `{ type, config }`.
- `workflow_actions` (`wac`) — `workflowId, order, type, config` (delete-all-then-
  insert on save, re-numbered).
- `workflow_runs` (`wrn`) — one per `(workflow, subject)` firing: `subjectType`
  (visitor|identity), `subjectId`, `status` (pending|running|waiting|completed|
  failed), `stepIndex`, `runAt`, `startedAt`, `finishedAt`, append-only `log`
  `[{ at, step, type, ok, detail }]`. **Unique index `(workflowId, subjectId)`**
  → dedupe per subject (a re-fire resets + re-runs the run).

### Triggers (non-invasive, best-effort hooks)
- **form_submitted** — hooked in `PublicFormsService.submit` (after the existing
  identity-link block). Matches on `config.formId` (blank = any form). Enqueues
  in a `void … .catch()` so it never disturbs the submit / CRM / notify path.
- **audience_enters** — hooked in the worker `audience-recompute` processor: it
  captures prior members, and after the delete-all-then-insert rebuild it fires
  for the **newcomers** (matched on `config.audienceId`).
- **score_threshold** — hooked in the worker `profile-rebuild` scoring pass: for
  each active `score_threshold` workflow it fires for subjects whose score
  **crossed up** through `config.threshold` (prev < T ≤ next) this run.
- **page_visited** — trigger type + config (`config.path`) supported; enqueue via
  the shared helper when wired to a page-visit source.

All hooks are best-effort: the API helper `WorkflowsService.enqueueForTrigger`
and the worker helper `enqueueWorkflowRuns` both swallow errors and return a
count — a workflow error can never break a form submit / audience recompute, so
the tenant-isolation + platform-admin gates are unaffected.

### Actions (worker executor)
Executed step-by-step by the `WORKFLOW_RUN` queue processor
(`workflow-run.processor.ts`):
- **adjust_score** (+N/−N to the visitor profile score; stubs a profile if absent),
- **add_to_audience** (materialize a membership), **add_tag** (logged),
- **send_webhook** (direct HMAC-signed POST to `config.url`, same scheme as E27),
- **enqueue_webhook_event** (create `webhook_deliveries` rows for matching E27
  subscriptions + enqueue the durable delivery worker),
- **send_email** (best-effort SMTP to the identity email or `config.to`; degrades
  gracefully when no mailer/SMTP is present — the run still completes),
- **wait** (persist `stepIndex`+`runAt`, re-enqueue self with a delay, resume).

The executor is idempotent (a `completed`/`failed` run is skipped; a paused/
deleted workflow aborts the run) and never crashes the worker — an action error
is logged into the run and the run is marked `failed`.

### API (site-scoped, `@Roles("editor")`)
- CRUD `/api/v1/workflows` (+ ordered actions), `PUT /api/v1/workflows/:id/status`
  (activate/pause), `GET /api/v1/workflows/:id/runs`, `POST /api/v1/workflows/:id/test`
  (dry-run: returns the ordered action plan; no side effects).

Module registered in `app.module.ts`; exported so the forms hook can enqueue.
`WorkflowsModule` needs no imports (QueueService, AuditService, ScopedRepository
are global via QueueModule/CommonModule).

## 3. Admin

Under the sidebar **Insights** group:
- **Attribution** (`/attribution`) — overview cards (conversions, revenue, top
  source/campaign), a **model selector** (first/last/linear/position), by-source /
  by-campaign / by-landing-page tables, a **model comparison** grid, and a recent-
  conversions table. Reuses the analytics `DateRangePicker` + range lib.
- **Workflows** (`/workflows`) — a list (name, trigger, status, action count,
  recent-run count) with activate/pause/test/delete, a **builder** modal (pick a
  trigger + configure → add ordered actions from a palette with per-action
  config), and a **runs** drawer (status badges + per-step log, auto-refreshing).

Query keys added to `ADMIN_QUERY_KEYS` (`ATTRIBUTION`, `WORKFLOWS`, `WORKFLOW`,
`WORKFLOW_RUNS`); routes in `router.tsx`; nav in `AppShell.tsx`.

## Queues
New `WORKFLOW_RUN` queue (mirrored in `apps/worker/src/queue-names.ts`):
- API producer `QueueService.enqueueWorkflowRun` (+ delay for resume).
- Worker consumer `workflow-run` (concurrency 3); the executor re-enqueues itself
  for a `wait`, the audience/profile hooks enqueue runs, and
  `enqueue_webhook_event` produces onto the existing `WEBHOOK_DELIVERY` queue.

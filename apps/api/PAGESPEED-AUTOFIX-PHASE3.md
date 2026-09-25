# PageSpeed Module — Phase 3 (Apply-All, Image Optimization, Richer Details, Progress & UI Polish)

This document describes the approach taken for the Phase 3 enhancements of the
Google PageSpeed / Lighthouse monitoring module. It builds directly on Phase 1
(recommendations capture + bulk scan) and Phase 2 (the auto-fix engine + preview
/ apply endpoints) — **no new tables, queues, processors, services, or
architecture were introduced.**

---

## 1. Scope delivered

| # | Requirement | Delivered |
|---|-------------|-----------|
| 1 | **Apply All Automatic Fixes** (UI + backend) — automatic-only | `applyAllAutomaticFixes` service method + `POST /audits/:id/fixes/apply-automatic` + "Apply all automatic" button. Only `category === "automatic"` fixes run; `one_click` and `manual` are skipped. |
| 2 | **Image Optimization Fix** for `uses-optimized-images` / `modern-image-formats` reusing the image pipeline | New `image-optimization.fix.ts` (multi-rule, `effect: "media-optimize"`). Applying it resolves the page's unoptimized images to their `media` rows and enqueues the **existing** `enqueueMediaProcess` job (WebP + responsive variants). No unrelated assets touched. |
| 3 | **Improve Recommendation Details** — savings (ms/KB), affected elements, clearer descriptions | Worker now captures `affectedCount` + `affectedSamples` from the LHR `details.items` (data already produced by Lighthouse). UI shows `~1.2s · ~340 KiB`, "N affected elements: …", and markdown-cleaned descriptions. |
| 4 | **Progress & Status Improvements** for bulk scans — completed / running / failed / pending | Worker marks rows `running` while in-flight and `failed` (vs `skipped`) on a real error. `getBatchProgress` returns per-status counts from the **existing** `page_audits` rows. |
| 5 | **UI Polish** in the Monitoring page — grouping, loading/empty/error, success/error feedback | Recommendations grouped by category with show-all toggle; bulk-scan progress bar; fixes-panel loading + error + empty states; toasts summarise applied draft changes and queued images. |

---

## 2. Design approach & key decisions

### 2.1 Extending the auto-fix engine (minimal, additive)
The Phase 2 engine assumed every fix edits the page layout (`plan(layout) →
FixPlan` persisted via `saveDraft`). Image optimization does **not** edit the
page — it queues background re-encoding. Two small, additive extensions to the
`AutoFix` interface cover this without a parallel engine:

- `ruleIds?: readonly string[]` — a fix can respond to **several** Lighthouse
  rules (image optimization handles both `uses-optimized-images` **and**
  `modern-image-formats`). The registry now maps every rule id → fix.
- `effect?: "layout" | "media-optimize"` (default `"layout"`) — the service
  branches on this: `layout` fixes go through `saveDraft`; `media-optimize`
  fixes queue image jobs. The fix modules stay **pure** (no DB / Nest); the
  side effect lives in the service.

### 2.2 Image optimization reuses the existing pipeline
`imageOptimizationFix.plan()` (pure) enumerates the page's **remote raster**
images that have no `variants` yet (skips SVG, `data:` URIs, relative paths, and
already-optimized images, and dedupes URLs). The service's `queueMediaOptimize`
resolves those URLs back to site-scoped `media` rows and calls the **existing**
`QueueService.enqueueMediaProcess` — the same job the media library already uses
on upload. External images (not in the library) are silently skipped. The
original asset is preserved; nothing on the page changes until variants are
ready.

### 2.3 Apply-all is a thin orchestration over the same registry
`applyAllAutomaticFixes` folds every automatic **layout** fix onto one working
layout and calls `saveDraft` **once**, then runs automatic **media-optimize**
fixes. It reuses `applicableFixes`, `plan`, `queueMediaOptimize`, and the same
`persistPlan` helper as the single-fix path — no separate logic.

### 2.4 Progress uses existing rows, not new tracking
No `audit_batches` table was added. The worker enriches the **existing**
`page_audits.status` lifecycle (`pending → running → completed | failed |
skipped`) and `getBatchProgress` derives all counts by grouping the batch's rows
by status. Polling continues while `pending + running > 0`.

### 2.5 Affected elements use data Lighthouse already produces
The worker already holds the full LHR at audit time. Phase 3 persists a
lightweight slice of `details.items` (count + up to 3 url/selector samples) into
the **existing** `recommendations` JSONB column — no new column, table, or
migration. Existing audit rows simply lack the field until re-scanned (the UI
omits it gracefully).

---

## 3. Every modified / added file and why

### Worker (`apps/worker`)
| File | Change |
|------|--------|
| `src/processors/page-audit.processor.ts` | Set `running` at job start; `failed` (vs `skipped`) on real errors; capture `affectedCount` + `affectedSamples` from `details.items`. |
| `src/db/schema.ts` | Extend `PageAuditRecommendation` with optional `affectedCount` / `affectedSamples` (same JSONB column). |

### API (`apps/api`)
| File | Change |
|------|--------|
| `src/database/schema/monitoring.schema.ts` | Mirror the `affectedCount` / `affectedSamples` fields. |
| `src/modules/monitoring/autofix/types.ts` | Add `ruleIds`, `effect`, and `fixRuleIds()` helper. |
| `src/modules/monitoring/autofix/fixes/image-optimization.fix.ts` | **New** multi-rule `media-optimize` fix for `uses-optimized-images` / `modern-image-formats`. |
| `src/modules/monitoring/autofix/registry.ts` | Register the fix; map every rule id (incl. `ruleIds`) → fix. |
| `src/modules/monitoring/autofix/__tests__/autofix.test.ts` | Tests for the new fix + multi-rule lookup. |
| `src/modules/monitoring/monitoring.service.ts` | `applyAllAutomaticFixes`, effect-branching `applyAuditFix`, `persistPlan`, `queueMediaOptimize`; `getBatchProgress` adds `running` / `failed`; `ApplyFixResult` type. |
| `src/modules/monitoring/monitoring.controller.ts` | `POST /audits/:id/fixes/apply-automatic`. |

### Admin (`apps/admin`)
| File | Change |
|------|--------|
| `src/views/monitoring/api/monitoring.api.ts` | `applyAllAutomaticFixesRequest`; reshape `ApplyFixResult` (`applied` / `queued` / `ruleIds` / `pageId`); extend `AuditBatchProgress` (running/failed), `PageAuditRecommendation` (affected*), `PageAuditStatus` (running). |
| `src/views/monitoring/hooks/useMonitoring.ts` | `useApplyAllAutomaticFixes`; batch polling continues while `pending` or `running`. |
| `src/views/monitoring/Monitoring.tsx` | `BulkScanProgress`, grouped `RecommendationsList` + `RecommendationItem`, "Apply all automatic" button, richer feedback + loading/error/empty states. |

---

## 4. Commit summary

1. **`feat(monitoring): capture affected elements + richer audit statuses`** — worker statuses (`running`/`failed`) + affected-element capture + schema-type mirror.
2. **`feat(monitoring): add image-optimization auto-fix (multi-rule + effect)`** — engine `ruleIds`/`effect`, image-optimization fix, registry, tests.
3. **`feat(monitoring): apply-all-automatic + media-optimize wiring + progress counts`** — service apply-all + media queueing + progress; controller endpoint.
4. **`feat(monitoring): admin api client + hooks for apply-all + richer types`** — API client + hooks + type updates.
5. **`feat(monitoring): UI polish — apply-all, richer recs, progress states`** — Monitoring page UI.

---

## 5. Build / test results

- `bunx tsc --noEmit` — **passes** for `apps/worker`, `apps/api`, `apps/admin`.
- `bun test src/modules/monitoring/autofix` — **14 pass / 0 fail**.
- `bun run build` (admin + api + worker + deps) — **9 tasks successful**.
- `eslint` — clean on all touched files (one pre-existing, unrelated
  `no-explicit-any` disable-directive warning in the worker processor; not
  error-level and present before this work).

---

## 6. Confirmation of constraints

- **No new tables / migrations** — reused the `page_audits.recommendations`
  JSONB column and the `status` field; no schema DDL added.
- **No new queues / processors / services** — image optimization reuses
  `QueueService.enqueueMediaProcess` and the existing `image-process` worker.
- **No renamed APIs or moved folders** — only additive endpoints/methods/types.
- **No unrelated files touched** — changes are confined to the monitoring
  module, its auto-fix engine, the worker page-audit processor, and the shared
  `PageAuditRecommendation` type mirror.
- **The only abstraction added** (`effect` + `ruleIds` on `AutoFix`) is the
  minimum required to let one fix queue background work and cover two Lighthouse
  rules — no new engine or registry.

---

## 7. How to extend further

- **New layout fix**: add `./autofix/fixes/<x>.fix.ts` returning a `FixPlan`,
  register it. Automatic ones are picked up by "Apply all automatic".
- **New background/queue fix**: set `effect: "media-optimize"` (or add a new
  effect + a matching branch in `persistPlan` / `queueMediaOptimize`).
- **More recommendation detail**: the worker already has the full LHR — extend
  `extractRecommendations` and the `PageAuditRecommendation` type (both mirrors).

## 8. Limitations / follow-up

- Image optimization matches `media.url` exactly; CDN-rewritten URLs won't
  resolve and are skipped (safe no-op). A URL-normalisation step could widen
  coverage later.
- `affectedCount` / `affectedSamples` only populate on **re-scan** after this
  change; historical audits show no affected data.
- `running` / `failed` counts require the worker with the updated processor
  deployed; in Chromium-less environments audits still report `skipped`.

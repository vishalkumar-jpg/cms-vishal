# PageSpeed Monitoring — Phase 5

Scheduled audits, performance alerts, trends, regression detection, dashboard
improvements, notifications and production-readiness — built by **extending**
Phases 1–4. No new tables, services, or processing pipelines: scheduling reuses
the existing `page-audit` queue + processor, and every analytic (trends,
alerts, regressions, durations) is derived from the existing `page_audits` rows.

## Features

1. **Scheduled scans** — per-site daily/weekly "scan all pages", configured in
   the Monitoring UI. An **hourly worker cron sweep** fans due sites onto the
   existing `PAGE_AUDIT` queue (same pipeline as the "Scan all pages" button).
   Deduped by `lastScheduledScanAt` + an in-flight guard.
2. **Performance alerts** — per-site thresholds (Performance / Accessibility /
   SEO / Best-practices / LCP / CLS). Pages whose latest scan breaches a
   threshold are surfaced on the dashboard.
3. **Performance trends** — dependency-free inline SVG sparklines per metric
   (Perf/SEO/A11y/Best/LCP/CLS) from a page's existing scan history.
4. **Regression detection** — largest average drops, newly-failing, and
   improving pages, computed latest-vs-previous per page.
5. **Dashboard improvements** — meta strip: overall health, pages scanned,
   last scan time, average scan time, next scheduled scan.
6. **Notifications** — a toast when regressions appear; success/error toasts on
   config save (within the existing sonner toast architecture).
7. **Production readiness** — duplicate-scan guard, retry/backoff on audit jobs,
   guarded worker sweep, offline banner + loading/empty/error states.

## Files changed

### Storage (additive — no new table)
| File | Why |
|---|---|
| `apps/api/src/database/schema/site-settings.schema.ts` | New `pageAuditConfig` jsonb (`schedule` + `alerts`) + `PageAuditConfig` type |
| `apps/api/src/database/migrations/0035_page_audit_config.sql` + `meta/_journal.json` | Duplicate-safe column migration |
| `apps/worker/src/db/schema.ts` | Mirror `pageAuditConfig`; minimal `sites` mirror for URL resolution |

### Scheduling (reuses PAGE_AUDIT queue)
| File | Why |
|---|---|
| `apps/worker/src/queue-names.ts` | `PAGE_AUDIT_SCHEDULE` queue + `SWEEP` job |
| `apps/worker/src/processors/page-audit-schedule.processor.ts` (new) | Hourly sweep → fan-out due sites onto PAGE_AUDIT; deduped + guarded |
| `apps/worker/src/worker.ts` | Register sweep worker + hourly repeatable cron |

### API (additive)
| File | Why |
|---|---|
| `apps/api/src/modules/monitoring/dto/monitoring.dto.ts` | `UpdateAuditConfigDto` (schedule + thresholds) |
| `apps/api/src/modules/monitoring/monitoring.service.ts` | `getAuditConfig`/`updateAuditConfig`; dashboard: scan durations, last/next scan, alerts, regressions; duplicate-scan guard |
| `apps/api/src/modules/monitoring/monitoring.controller.ts` | `GET`/`PUT audits/config` |
| `apps/api/src/modules/queue/queue.service.ts` | Retry/backoff on `enqueuePageAudit` |

### Admin (additive)
| File | Why |
|---|---|
| `apps/admin/src/views/monitoring/api/monitoring.api.ts` | Config types + requests; summary extensions |
| `apps/admin/src/views/monitoring/hooks/useMonitoring.ts` | `useAuditConfig`, `useUpdateAuditConfig` |
| `apps/admin/src/views/monitoring/components/AuditSchedule.tsx` (new) | Schedule + alert-threshold form |
| `apps/admin/src/views/monitoring/components/PerformanceAlerts.tsx` (new) | Threshold breaches + regression lists |
| `apps/admin/src/views/monitoring/components/TrendSparkline.tsx` (new) | Inline SVG sparkline |
| `apps/admin/src/views/monitoring/components/ScanHistory.tsx` | Per-metric trend charts |
| `apps/admin/src/views/monitoring/components/PerformanceDashboard.tsx` | Meta strip (health, last/next scan, duration) |
| `apps/admin/src/views/monitoring/Monitoring.tsx` | Compose schedule + alerts; regression toast + offline banner |

## Commits
- `feat(monitoring): store per-site PageSpeed schedule + alert config`
- `feat(monitoring): hourly worker sweep for scheduled PageSpeed scans`
- `feat(monitoring): schedule/alert config API + dashboard trends, alerts & regressions`
- `feat(monitoring): admin client + hooks for schedule config & dashboard trends`
- `feat(monitoring): schedule form, alerts, regressions, trend charts & dashboard meta`

## Build / test results
- `apps/worker` type-check: **pass**
- `apps/api` type-check + `nest build`: **pass** (292 files)
- `apps/admin` type-check + `vite build`: **pass**
- `apps/api` monitoring autofix unit tests: **14 pass / 0 fail**
- Lint (changed files): **clean**

## Notes / limitations
- **Scan duration** is `createdAt → ranAt` (queue wait + Lighthouse run); no new
  column was added.
- Scheduling requires the worker + Redis running; the sweep must fire at least
  hourly to honour the configured `hour` (override via `PAGE_AUDIT_SCHEDULE_CRON`).
- Trends/alerts/regressions are computed from the capped dashboard rollup — no
  duplicated audit storage.

## No unnecessary refactoring
No APIs renamed, no files moved, no unrelated modules touched. The only new
runtime surface is the hourly schedule sweep (the established worker-cron
pattern, e.g. the SSL/scheduled-publish sweeps) which reuses the existing
page-audit pipeline end-to-end.

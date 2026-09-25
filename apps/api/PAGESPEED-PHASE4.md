# PageSpeed Monitoring — Phase 4 (History, Dashboard, Reporting, Filtering, UI)

Phase 4 builds on Phases 1–3. It adds scan history, a performance dashboard,
reporting (PDF/CSV/JSON), advanced filtering, and UI polish. It **extends the
existing Monitoring module only** — no new tables, queues, processors, services,
renamed APIs, or moved files. The single backend addition is one read-only
aggregate endpoint over the existing `page_audits` rows.

---

## 1. Approach & key decisions

### 1.1 Everything is derived from `page_audits` (no new storage)
All five features read the data Phases 1–3 already capture. The dashboard rollup
is computed in memory over a bounded, newest-first fetch and reduced to the
**latest + previous** scan per path — Drizzle-only, matching the codebase (no raw
window SQL, for which there was no precedent).

### 1.2 One new read-only endpoint powers the dashboard + overview
`GET /monitoring/audits/summary` returns overall health, category averages,
per-status counts, best/worst pages, and one row per path (latest scan + previous
scan for trends + flagged categories). Because it returns **one row per page**,
advanced filtering/sorting is done client-side and is correct across the whole
site without extra requests.

### 1.3 Scan history reuses the existing list endpoint
Per-page history is just `GET /monitoring/audits?path=…`, which already returns a
path's audits newest-first. Phase 4 adds optional `status` + `from`/`to` query
params for the date filter. Latest-vs-previous comparison is `rows[0]` vs
`rows[1]`.

### 1.4 Reporting is client-side, from already-fetched data
CSV/JSON are built from the dashboard rollup; PDF uses the browser's print dialog
("Save as PDF"). No PDF dependency, no backend endpoint, and nothing stored is
duplicated. Mirrors the existing `forms/lib/csv.ts` download pattern.

### 1.5 UI is additive; existing behaviour preserved
`PageAuditsTab` now composes a dashboard, a pages-overview table, and a per-page
scan-history header **above** the existing audit cards. Run / scan-all /
recommendations / auto-fix all keep working unchanged.

---

## 2. Every modified / added file and why

### API (`apps/api`) — additive
| File | Change |
|------|--------|
| `src/modules/monitoring/dto/monitoring.dto.ts` | Add `PAGE_AUDIT_STATUSES`; extend `AuditsQueryDto` with optional `status`, `from`, `to`. |
| `src/modules/monitoring/monitoring.service.ts` | Extend `listAudits` (apply status + date range); add `getDashboardSummary()` + a `mean()` helper + dashboard interfaces (`AuditScores`, `DashboardPage`, `AuditDashboardSummary`). |
| `src/modules/monitoring/monitoring.controller.ts` | Add `GET audits/summary` (site_admin), ordered before the `:id` routes. |

### Admin (`apps/admin`) — additive
| File | Change |
|------|--------|
| `src/views/monitoring/api/monitoring.api.ts` | Add `AuditsQuery`, dashboard types (`AuditScores`/`DashboardPage`/`AuditDashboardSummary`), `getAuditSummaryRequest`; extend `listAuditsRequest` with status/from/to. |
| `src/views/monitoring/hooks/useMonitoring.ts` | Add `useAuditDashboard`; change `usePageAudits` to take a query object (path/status/from/to) as part of the cache key. |
| `src/views/monitoring/lib/export.ts` **(new)** | `pagesToCsv`, `summaryToJson`, `downloadText`, `printPagesReport` (browser-print PDF). |
| `src/views/monitoring/components/PerformanceDashboard.tsx` **(new)** | Health + category-average cards with trend, best/worst pages. |
| `src/views/monitoring/components/PagesOverview.tsx` **(new)** | Pages table: search + score-band + status + category filters, sort by any score, CSV/JSON/PDF export. |
| `src/views/monitoring/components/ScanHistory.tsx` **(new)** | Date-range filter + latest-vs-previous compare (scores + Core Web Vitals). |
| `src/views/monitoring/Monitoring.tsx` | Compose the above into `PageAuditsTab`; add Clear-filter, section heading, dashed empty states. |

---

## 3. Commit summary
1. `feat(monitoring): dashboard summary rollup + audit list date/status filters` — backend endpoint + service + DTO.
2. `feat(monitoring): admin client + hooks for dashboard summary & audit filters` — API client + hooks (+ one caller update).
3. `feat(monitoring): dashboard, pages-overview & scan-history components + export` — reporting lib + 3 components.
4. `feat(monitoring): compose PageSpeed dashboard, overview & history into audits tab` — UI wiring.
5. `docs(monitoring): document PageSpeed Phase 4 change approach` — this file.

---

## 4. Implemented features (mapped to scope)
- **Scan History** — per-page previous scans (audit cards), latest-vs-previous compare for Perf/A11y/Best/SEO + LCP/CLS, date-range filter.
- **Performance Dashboard** — overall health, category averages, best/lowest pages, summary cards, trend indicators (vs each page's previous scan).
- **Reporting** — export the (filtered) scan results as CSV, JSON, or PDF, all from existing data.
- **Advanced Filtering** — search pages, filter by score band / status / flagged category, sort by any Lighthouse score.
- **UI Improvements** — loading / empty (dashed) / error states, success toasts, responsive grids, cleaner recommendation grouping (from Phase 3), print-friendly report.

---

## 5. Build / type-check / test results
- `bunx tsc --noEmit` — **passes** for `apps/api` and `apps/admin`.
- `bun run build` (admin + api + worker + deps) — **9 tasks successful**.
- `bun test …/autofix` — **14 pass / 0 fail** (existing suite still green).
- `eslint` — clean on all touched/added files.

---

## 6. Confirmation: no unnecessary refactoring / unrelated changes
- **No new tables / migrations / queues / processors / services.** The dashboard rollup and history reuse existing `page_audits` rows and the existing list endpoint.
- **No renamed APIs, no moved files.** Only additive endpoints, params, types, hooks, a lib, and three new components.
- **No unrelated modules touched.** Changes are confined to the Monitoring module (API) and the Monitoring view (admin).
- **Existing features intact** — run audit, bulk scan + progress, recommendations, and Phase 2/3 auto-fixes are unchanged and verified building/passing.

## 7. Limitations / follow-up
- Dashboard covers up to `PAGE_AUDIT_DASHBOARD_CAP` (default 2000, env-overridable) most-recent audits; extremely deep histories beyond the cap won't contribute older pages (newest-active pages are always covered).
- PDF export relies on the browser print dialog; pop-up blockers are handled with a toast.
- Trends need ≥2 scans for a page; single-scan pages show no delta.

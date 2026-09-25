import type { AuditDashboardSummary, DashboardPage } from "../api/monitoring.api";
import { fmtScoreCell, fmtDateTime } from "./format";

/**
 * Client-side reporting for PageSpeed scans. Everything is built from data the
 * dashboard already fetched — no backend endpoint, no new stored artifacts.
 * Mirrors the CSV download pattern used by the forms module.
 */

/** Mean of non-null numbers (rounded); null when empty. */
const mean = (values: (number | null)[]): number | null => {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
};

/**
 * Rebuild rollup cards (health / averages / counts) from a page list — used so
 * filtered CSV/JSON/PDF exports don't keep the unfiltered site-wide numbers.
 */
export const summaryFromPages = (
  base: AuditDashboardSummary,
  pages: DashboardPage[],
): AuditDashboardSummary => {
  const ranked = pages
    .filter((p) => p.average !== null)
    .sort((a, b) => (b.average as number) - (a.average as number));
  const top = 5;
  const paths = new Set(pages.map((p) => p.path));
  const completedPages = pages.filter((p) => p.status === "completed");
  const mostRecent = completedPages.reduce<DashboardPage | null>(
    (latest, p) => (!latest || (p.ranAt ?? "") > (latest.ranAt ?? "") ? p : latest),
    null,
  );
  return {
    ...base,
    pages,
    health: mean(pages.map((p) => p.average)),
    previousHealth: mean(pages.map((p) => p.previous?.average ?? null)),
    averages: {
      performanceScore: mean(pages.map((p) => p.performanceScore)),
      accessibilityScore: mean(pages.map((p) => p.accessibilityScore)),
      seoScore: mean(pages.map((p) => p.seoScore)),
      bestPracticesScore: mean(pages.map((p) => p.bestPracticesScore)),
    },
    counts: {
      pages: pages.length,
      completed: pages.filter((p) => p.status === "completed").length,
      running: pages.filter((p) => p.status === "running").length,
      pending: pages.filter((p) => p.status === "pending").length,
      failed: pages.filter((p) => p.status === "failed").length,
      skipped: pages.filter((p) => p.status === "skipped" || p.status === "seam").length,
    },
    best: ranked.slice(0, top),
    worst: ranked.slice(Math.max(top, ranked.length - top)).reverse(),
    alertingPages: (base.alertingPages ?? []).filter((a) => paths.has(a.path)),
    regressions: {
      largestDrops: base.regressions.largestDrops.filter((r) => paths.has(r.path)),
      newlyFailing: base.regressions.newlyFailing.filter((r) => paths.has(r.path)),
      improving: base.regressions.improving.filter((r) => paths.has(r.path)),
    },
    lastScanAt: mostRecent?.ranAt ?? null,
    lastScanDurationMs: mostRecent?.durationMs ?? null,
    avgScanDurationMs: mean(completedPages.map((p) => p.durationMs)),
  };
};

/** Escape a CSV cell: quote when needed + neutralise spreadsheet formula-injection. */
const escapeCsv = (raw: string): string => {
  let v = raw;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
};

const PAGE_COLUMNS = [
  "path",
  "status",
  "ranAt",
  "performance",
  "accessibility",
  "seo",
  "bestPractices",
  "average",
  "lcpMs",
  "cls",
  "previousAverage",
] as const;

/** One row per page (latest scan) → CSV, reusing the dashboard rollup. */
export const pagesToCsv = (pages: DashboardPage[]): string => {
  const lines = pages.map((p) =>
    [
      p.path,
      p.status,
      p.ranAt,
      fmtScoreCell(p.performanceScore),
      fmtScoreCell(p.accessibilityScore),
      fmtScoreCell(p.seoScore),
      fmtScoreCell(p.bestPracticesScore),
      fmtScoreCell(p.average),
      typeof p.lcp === "number" ? String(Math.round(p.lcp)) : "",
      typeof p.cls === "number" ? p.cls.toFixed(3) : "",
      fmtScoreCell(p.previous?.average ?? null),
    ]
      .map((c) => escapeCsv(String(c)))
      .join(","),
  );
  return [PAGE_COLUMNS.join(","), ...lines].join("\r\n");
};

/** Full dashboard rollup → pretty JSON (scores + averages + counts + pages). */
export const summaryToJson = (summary: AuditDashboardSummary): string =>
  JSON.stringify(summary, null, 2);

/** Trigger a browser download of an in-memory text file. */
export const downloadText = (filename: string, mime: string, text: string): void => {
  const blob = new Blob([text], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Open a print-friendly PageSpeed report in a new window and trigger the browser
 * print dialog (the user chooses "Save as PDF"). Returns false if the window was
 * blocked so the caller can surface an error. Card aggregates are re-derived from
 * `summary.pages` so a filtered export stays internally consistent.
 */
export const printPagesReport = (siteLabel: string, summary: AuditDashboardSummary): boolean => {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!win) return false;

  const derived = summaryFromPages(summary, summary.pages);
  const cell = (v: number | null): string =>
    typeof v === "number" ? String(v) : '<span style="color:#999">—</span>';

  const rows = derived.pages
    .map(
      (p) => `<tr>
        <td>${escapeHtml(p.path)}</td>
        <td>${escapeHtml(p.status)}</td>
        <td class="n">${cell(p.performanceScore)}</td>
        <td class="n">${cell(p.accessibilityScore)}</td>
        <td class="n">${cell(p.bestPracticesScore)}</td>
        <td class="n">${cell(p.seoScore)}</td>
        <td class="n">${cell(p.average)}</td>
        <td>${escapeHtml(fmtDateTime(p.ranAt))}</td>
      </tr>`,
    )
    .join("");

  const a = derived.averages;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8" />
    <title>PageSpeed report — ${escapeHtml(siteLabel)}</title>
    <style>
      body{font:14px/1.4 system-ui,Segoe UI,Roboto,sans-serif;color:#111;margin:32px}
      h1{font-size:20px;margin:0 0 4px} .sub{color:#666;margin:0 0 20px;font-size:12px}
      .cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
      .card{border:1px solid #ddd;border-radius:8px;padding:10px 14px;min-width:120px}
      .card .v{font-size:22px;font-weight:600} .card .l{color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
      table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #e5e5e5;padding:6px 8px;text-align:left} th{background:#f7f7f7}
      td.n,th.n{text-align:right} @media print{body{margin:12px}}
    </style></head><body>
    <h1>PageSpeed report</h1>
    <p class="sub">${escapeHtml(siteLabel)} · generated ${escapeHtml(new Date().toLocaleString())}</p>
    <div class="cards">
      <div class="card"><div class="v">${cell(derived.health)}</div><div class="l">Health</div></div>
      <div class="card"><div class="v">${cell(a.performanceScore)}</div><div class="l">Performance</div></div>
      <div class="card"><div class="v">${cell(a.accessibilityScore)}</div><div class="l">Accessibility</div></div>
      <div class="card"><div class="v">${cell(a.bestPracticesScore)}</div><div class="l">Best practices</div></div>
      <div class="card"><div class="v">${cell(a.seoScore)}</div><div class="l">SEO</div></div>
      <div class="card"><div class="v">${derived.counts.pages}</div><div class="l">Pages</div></div>
    </div>
    <table><thead><tr>
      <th>Path</th><th>Status</th><th class="n">Perf</th><th class="n">A11y</th>
      <th class="n">Best</th><th class="n">SEO</th><th class="n">Avg</th><th>Last scan</th>
    </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
  win.document.close();
  win.focus();
  // Let the new document lay out before invoking print.
  win.setTimeout(() => win.print(), 250);
  return true;
};

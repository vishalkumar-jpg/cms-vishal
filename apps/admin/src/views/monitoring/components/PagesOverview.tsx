import * as React from "react";
import { FileJson, FileText, Printer, Search } from "lucide-react";
import { Button, Input, toast } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSiteStore } from "@/store/siteStore";
import type { AuditDashboardSummary, DashboardPage } from "../api/monitoring.api";
import { downloadText, pagesToCsv, printPagesReport, summaryFromPages, summaryToJson } from "../lib/export";
import { fmtScore, scoreClass } from "../lib/format";

type SortKey = "average" | "performanceScore" | "accessibilityScore" | "seoScore" | "bestPracticesScore" | "path";
type ScoreBand = "all" | "good" | "average" | "poor";

const SORT_LABELS: Record<SortKey, string> = {
  average: "Average",
  performanceScore: "Performance",
  accessibilityScore: "Accessibility",
  bestPracticesScore: "Best practices",
  seoScore: "SEO",
  path: "Path",
};

const inBand = (avg: number | null, band: ScoreBand): boolean => {
  if (band === "all") return true;
  if (typeof avg !== "number") return false;
  if (band === "good") return avg >= 90;
  if (band === "average") return avg >= 50 && avg < 90;
  return avg < 50;
};

/**
 * All-pages overview with advanced filtering (search / score band / status /
 * flagged category), sorting by any Lighthouse score, and CSV/JSON/PDF export.
 * Operates purely on the dashboard rollup (one row per page), so filtering and
 * sorting are correct across the whole site without extra requests.
 */
export const PagesOverview: React.FC<{
  summary: AuditDashboardSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  selectedPath: string;
  onSelectPath: (path: string) => void;
}> = ({ summary, isLoading, isError, selectedPath, onSelectPath }) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");
  const [category, setCategory] = React.useState<string>("all");
  const [band, setBand] = React.useState<ScoreBand>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("average");
  const [asc, setAsc] = React.useState(false);

  const pages = summary?.pages ?? [];

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of pages) for (const c of p.flaggedCategories) set.add(c);
    return [...set].sort();
  }, [pages]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = pages.filter(
      (p) =>
        (q === "" || p.path.toLowerCase().includes(q)) &&
        (status === "all" || p.status === status) &&
        (category === "all" || p.flaggedCategories.includes(category)) &&
        inBand(p.average, band),
    );
    const dir = asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "path") return a.path.localeCompare(b.path) * dir;
      const av = a[sortKey];
      const bv = b[sortKey];
      // Nulls always sort last regardless of direction.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir;
    });
  }, [pages, search, status, category, band, sortKey, asc]);

  const onExportCsv = (): void =>
    downloadText(`pagespeed-${siteId ?? "site"}.csv`, "text/csv", pagesToCsv(filtered));
  const onExportJson = (): void => {
    if (!summary) return;
    const derived = summaryFromPages(summary, filtered);
    downloadText(`pagespeed-${siteId ?? "site"}.json`, "application/json", summaryToJson(derived));
  };
  const onExportPdf = (): void => {
    if (summary && !printPagesReport(siteId ?? "site", summaryFromPages(summary, filtered))) {
      toast.error("Enable pop-ups to export the PDF report");
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading pages…</p>;
  if (isError && !summary) {
    return <p className="text-sm text-muted-foreground">Could not load pages.</p>;
  }
  if (!summary || pages.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No page scans yet. Run an audit or scan all pages to populate the dashboard.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      {isError && (
        <p className="border-b border-border px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Showing cached page data — refresh failed.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
        <div className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages…"
            className="h-8 pl-7"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
            <SelectItem value="seam">Legacy (seam)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={band} onValueChange={(v) => setBand(v as ScoreBand)}>
          <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any score</SelectItem>
            <SelectItem value="good">Good (≥90)</SelectItem>
            <SelectItem value="average">Average (50–89)</SelectItem>
            <SelectItem value="poor">Poor (&lt;50)</SelectItem>
          </SelectContent>
        </Select>
        {categories.length > 0 && (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => setAsc((v) => !v)}>
          {asc ? "Asc" : "Desc"}
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" onClick={onExportCsv} title="Export CSV">
            <FileText className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onExportJson} title="Export JSON">
            <FileJson className="mr-1 h-3.5 w-3.5" /> JSON
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onExportPdf} title="Export PDF">
            <Printer className="mr-1 h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No pages match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Page audit results">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-2 font-medium">Page</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 text-right font-medium">Perf</th>
                <th className="p-2 text-right font-medium">A11y</th>
                <th className="p-2 text-right font-medium">Best</th>
                <th className="p-2 text-right font-medium">SEO</th>
                <th className="p-2 text-right font-medium">Avg</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: DashboardPage) => (
                <tr
                  key={p.auditId}
                  tabIndex={0}
                  aria-selected={p.path === selectedPath}
                  aria-label={`${p.path}, ${p.status}, average ${fmtScore(p.average)}`}
                  className={`cursor-pointer border-b border-border/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                    p.path === selectedPath ? "bg-muted/60" : ""
                  }`}
                  onClick={() => onSelectPath(p.path)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectPath(p.path);
                    }
                  }}
                >
                  <td className="max-w-[16rem] truncate p-2" title={p.path}>{p.path}</td>
                  <td className="p-2">
                    <Badge variant={p.status === "completed" ? "default" : "outline"}>{p.status}</Badge>
                  </td>
                  <td className={`p-2 text-right font-semibold ${scoreClass(p.performanceScore)}`}>{fmtScore(p.performanceScore)}</td>
                  <td className={`p-2 text-right font-semibold ${scoreClass(p.accessibilityScore)}`}>{fmtScore(p.accessibilityScore)}</td>
                  <td className={`p-2 text-right font-semibold ${scoreClass(p.bestPracticesScore)}`}>{fmtScore(p.bestPracticesScore)}</td>
                  <td className={`p-2 text-right font-semibold ${scoreClass(p.seoScore)}`}>{fmtScore(p.seoScore)}</td>
                  <td className={`p-2 text-right font-semibold ${scoreClass(p.average)}`}>{fmtScore(p.average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

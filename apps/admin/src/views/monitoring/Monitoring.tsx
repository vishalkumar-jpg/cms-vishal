import * as React from "react";
import { Activity, AlertTriangle, Gauge, Link2, RefreshCw, Send, Wrench, Zap } from "lucide-react";
import { Button, Input, Tabs, TabsContent, TabsList, TabsTrigger, toast } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { useSiteStore } from "@/store/siteStore";
import {
  useApplyAllAutomaticFixes,
  useApplyAuditFix,
  useAuditBatch,
  useAuditDashboard,
  useAuditFixes,
  useCrmDeliveries,
  useLinkCheck,
  usePageAudits,
  useRetryCrmDelivery,
  useRunAudit,
  useRunLinkCheck,
  useRuntimeErrors,
  useScanAllAudits,
} from "./hooks/useMonitoring";
import { PerformanceDashboard } from "./components/PerformanceDashboard";
import { PagesOverview } from "./components/PagesOverview";
import { ScanHistory } from "./components/ScanHistory";
import { AuditSchedule } from "./components/AuditSchedule";
import { PerformanceAlerts } from "./components/PerformanceAlerts";
import type {
  ApplyFixResult,
  AuditBatchProgress,
  AuditFix,
  BrokenLink,
  CrmDelivery,
  FixCategory,
  PageAudit,
  PageAuditRecommendation,
  RuntimeError,
} from "./api/monitoring.api";

const fmtWhen = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

/** Canonical audit path (leading slash, no trailing slash except `/`). */
const normalizeAuditPath = (path: string): string => {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "") || "/";
};

const CRM_RETRYABLE = new Set(["failed", "dead_lettered"]);

const STATUS_VARIANT: Record<string, "default" | "outline" | "destructive" | "secondary"> = {
  delivered: "default",
  delivering: "secondary",
  stored: "outline",
  failed: "destructive",
  dead_lettered: "destructive",
};

/**
 * Monitoring hub (#29/#37/#30): CRM deliveries (with retry), runtime errors
 * (grouped by message with counts), and page audits (Lighthouse score cards +
 * recommendations, single-page + bulk "scan all pages"). Site-scoped via the
 * active-site header.
 */
export const Monitoring: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);

  if (!siteId) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8 text-sm text-muted-foreground">
        Select a site to view monitoring.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          CRM delivery status, captured runtime errors, and page-audit scores for this website.
        </p>
      </div>

      <Tabs defaultValue="crm">
        <TabsList className="mb-4">
          <TabsTrigger value="crm">
            <Activity className="mr-1.5 h-4 w-4" /> CRM deliveries
          </TabsTrigger>
          <TabsTrigger value="errors">
            <AlertTriangle className="mr-1.5 h-4 w-4" /> Runtime errors
          </TabsTrigger>
          <TabsTrigger value="audits">
            <Gauge className="mr-1.5 h-4 w-4" /> Page audits
          </TabsTrigger>
          <TabsTrigger value="links">
            <Link2 className="mr-1.5 h-4 w-4" /> Broken links
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crm">
          <CrmDeliveriesTab />
        </TabsContent>
        <TabsContent value="errors">
          <RuntimeErrorsTab />
        </TabsContent>
        <TabsContent value="audits">
          <PageAuditsTab key={siteId} />
        </TabsContent>
        <TabsContent value="links">
          <BrokenLinksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// --- #29 CRM deliveries -----------------------------------------------------

const CRM_STATUSES = ["", "stored", "delivering", "delivered", "failed", "dead_lettered"];

const CrmDeliveriesTab: React.FC = () => {
  const [status, setStatus] = React.useState<string>("");
  const { data, isLoading, isError } = useCrmDeliveries(status || undefined);
  const retry = useRetryCrmDelivery();
  const rows: CrmDelivery[] = data?.rows ?? [];

  const onRetry = (id: string): void => {
    retry.mutate(id, {
      onSuccess: () => toast.success("Delivery re-enqueued"),
      onError: () => toast.error("Could not re-enqueue delivery"),
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="crm-status">
          Status
        </label>
        <select
          id="crm-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {CRM_STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s || "All"}
            </option>
          ))}
        </select>
      </div>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Form</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Attempts</th>
              <th className="px-4 py-3 font-medium">Last error</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <EmptyRow colSpan={6} text="Loading deliveries…" />}
            {isError && <EmptyRow colSpan={6} text="Could not load CRM deliveries." />}
            {!isLoading && !isError && rows.length === 0 && (
              <EmptyRow colSpan={6} text="No form submissions to deliver yet." />
            )}
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {fmtWhen(r.createdAt)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.formId}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{r.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.deliveryAttempts}</td>
                <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={r.lastError ?? ""}>
                  {r.lastError ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retry.isPending || !CRM_RETRYABLE.has(r.status)}
                    onClick={() => onRetry(r.id)}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- #37 Runtime errors -----------------------------------------------------

const RuntimeErrorsTab: React.FC = () => {
  const [source, setSource] = React.useState<string>("");
  const { data, isLoading, isError } = useRuntimeErrors(source || undefined);
  const rows: RuntimeError[] = data?.rows ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="err-source">
          Source
        </label>
        <select
          id="err-source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {["", "renderer", "admin", "api"].map((s) => (
            <option key={s || "all"} value={s}>
              {s || "All"}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading errors…</p>}
      {isError && <p className="text-sm text-muted-foreground">Could not load runtime errors.</p>}
      {!isLoading && !isError && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No runtime errors captured yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((e) => (
          <div key={e.id} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{e.source}</Badge>
                  <Badge variant="destructive">{e.count}×</Badge>
                </div>
                <p className="mt-1 break-words font-medium">{e.message}</p>
                {e.url && <p className="truncate text-xs text-muted-foreground">{e.url}</p>}
              </div>
              <div className="whitespace-nowrap text-right text-xs text-muted-foreground">
                <div>last: {fmtWhen(e.lastSeen)}</div>
                <div>first: {fmtWhen(e.firstSeen)}</div>
              </div>
            </div>
            {e.stack && (
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                {e.stack}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- #30 Page audits --------------------------------------------------------

const score = (v: number | null): string => (v === null ? "—" : String(v));

const PageAuditsTab: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [path, setPath] = React.useState("");
  const [filter, setFilter] = React.useState<string | undefined>(undefined);
  const [range, setRange] = React.useState<{ from?: string; to?: string }>({});
  const [batchId, setBatchId] = React.useState<string | null>(null);

  const dashboard = useAuditDashboard();
  const { refetch: refetchDashboard } = dashboard;
  const { data, isLoading, isError, refetch: refetchAudits } = usePageAudits({
    path: filter,
    from: range.from,
    to: range.to,
  });
  const run = useRunAudit();
  const scanAll = useScanAllAudits();
  const batch = useAuditBatch(batchId);
  const rows: PageAudit[] = data?.rows ?? [];

  // Offline banner (Production readiness): dashboard data may be stale offline.
  const [online, setOnline] = React.useState(
    () => (typeof navigator !== "undefined" ? navigator.onLine : true),
  );
  React.useEffect(() => {
    const on = (): void => setOnline(true);
    const off = (): void => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const onSelectPath = (p: string): void => {
    setPath(p);
    setFilter(p);
    setRange({});
  };

  const onRun = (): void => {
    if (!online) {
      toast.error("You’re offline — scans are paused");
      return;
    }
    const raw = path.trim();
    if (!raw) {
      toast.error("Enter a page path (e.g. /pricing)");
      return;
    }
    const p = normalizeAuditPath(raw);
    run.mutate(
      { path: p },
      {
        onSuccess: () => toast.success(`Audit queued for ${p} — refresh shortly for results`),
        onError: () => toast.error("Could not run audit"),
      },
    );
  };

  const onScanAll = (): void => {
    if (!online) {
      toast.error("You’re offline — scans are paused");
      return;
    }
    scanAll.mutate(undefined, {
      onSuccess: (res) => {
        setBatchId(res.batchId || null);
        toast.success(`Scanning ${res.queued} page${res.queued === 1 ? "" : "s"}…`);
      },
      onError: () => toast.error("Could not start scan"),
    });
  };

  const progress = batch.data ?? null;

  // Refetch dashboard + audit list before dismissing bulk-scan progress.
  React.useEffect(() => {
    if (!batchId || !progress) return;
    if (progress.pending !== 0 || progress.running !== 0) return;
    let cancelled = false;
    void (async () => {
      await Promise.all([refetchDashboard(), refetchAudits()]);
      if (!cancelled) setBatchId(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId, progress, refetchDashboard, refetchAudits]);

  // Surface batch polling failures and release the orphaned batchId.
  React.useEffect(() => {
    if (!batchId || !batch.isError) return;
    toast.error("Could not load bulk-scan progress");
    setBatchId(null);
  }, [batchId, batch.isError]);

  // Reset scan-history date range whenever the filtered path changes.
  React.useEffect(() => {
    setRange({});
  }, [filter]);

  // Regression notification: toast once per distinct regression set (Phase 5).
  const notifiedRegressions = React.useRef("");
  React.useEffect(() => {
    const reg = dashboard.data?.regressions;
    if (!reg) return;
    const worse = [...reg.largestDrops, ...reg.newlyFailing];
    if (worse.length === 0) {
      notifiedRegressions.current = "";
      sessionStorage.removeItem(`obcms-regression:${siteId ?? ""}`);
      return;
    }
    const sig = worse.map((r) => `${r.auditId}:${r.delta}`).join("|");
    const storageKey = `obcms-regression:${siteId ?? ""}`;
    if (sig === notifiedRegressions.current || sessionStorage.getItem(storageKey) === sig) return;
    notifiedRegressions.current = sig;
    sessionStorage.setItem(storageKey, sig);
    toast.warning(
      `${worse.length} page${worse.length === 1 ? "" : "s"} regressed since the previous scan`,
    );
  }, [dashboard.data, siteId]);

  return (
    <div>
      {!online && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
          You’re offline — showing the last loaded data. Scans and config changes are paused.
        </div>
      )}
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const raw = path.trim();
          setFilter(raw ? normalizeAuditPath(raw) : undefined);
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="audit-path">
            Page path
          </label>
          <Input
            id="audit-path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/pricing"
            className="w-64"
          />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {filter && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFilter(undefined);
              setPath("");
              setRange({});
            }}
          >
            Clear
          </Button>
        )}
        <Button type="button" disabled={!online || run.isPending} onClick={onRun}>
          <Send className="mr-1 h-3.5 w-3.5" /> Run audit
        </Button>
        <Button type="button" variant="secondary" disabled={!online || scanAll.isPending} onClick={onScanAll}>
          <Gauge className="mr-1 h-3.5 w-3.5" /> Scan all pages
        </Button>
      </form>

      {progress && <BulkScanProgress progress={progress} />}

      <AuditSchedule online={online} />

      <PerformanceDashboard
        summary={dashboard.data}
        isLoading={dashboard.isLoading}
        isError={dashboard.isError}
        onSelectPath={onSelectPath}
      />

      <PerformanceAlerts summary={dashboard.data} onSelectPath={onSelectPath} />

      <div className="mb-5">
        <PagesOverview
          summary={dashboard.data}
          isLoading={dashboard.isLoading}
          isError={dashboard.isError}
          selectedPath={filter ?? ""}
          onSelectPath={onSelectPath}
        />
      </div>

      {filter && <ScanHistory path={filter} rows={rows} onDateChange={(from, to) => setRange({ from, to })} />}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">{filter ? `Scans for ${filter}` : "Recent audits"}</p>
        {data?.hasMore && <span className="text-xs text-muted-foreground">Showing latest {rows.length}</span>}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading audits…</p>}
      {isError && rows.length > 0 && (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
          Showing cached audits — refresh failed.
        </p>
      )}
      {isError && !isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Could not load page audits.</p>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {filter
            ? "No scans for this page in the selected range. Run an audit or clear the date filter."
            : "No audits recorded yet. Run one above or scan all pages."}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((a) => (
          <div key={a.id} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="truncate font-medium" title={a.path}>
                {a.path}
              </p>
              <Badge variant={a.status === "completed" ? "default" : "outline"}>{a.status}</Badge>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{fmtWhen(a.ranAt)}</p>
            {a.detail && (
              <p className="mb-3 truncate text-xs text-amber-700 dark:text-amber-400" title={a.detail}>
                {a.detail}
              </p>
            )}
            <div className="grid grid-cols-4 gap-2 text-center">
              <ScoreCell label="Perf" value={score(a.performanceScore)} />
              <ScoreCell label="A11y" value={score(a.accessibilityScore)} />
              <ScoreCell label="SEO" value={score(a.seoScore)} />
              <ScoreCell label="Best" value={score(a.bestPracticesScore)} />
            </div>
            <RecommendationsList items={a.recommendations} />
            <FixesPanel auditId={a.id} online={online} />
          </div>
        ))}
      </div>
    </div>
  );
};

/** Bulk "scan all pages" progress: settled/total bar + per-status counts. */
const BulkScanProgress: React.FC<{ progress: AuditBatchProgress }> = ({ progress }) => {
  const { total, completed, running, pending, failed, skipped } = progress;
  const settled = completed + failed + skipped;
  const pct = total > 0 ? Math.round((settled / total) * 100) : 0;
  const active = pending + running > 0;
  return (
    <div className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="font-medium">Bulk scan</span>
        <Badge variant={active ? "secondary" : "default"}>
          {completed}/{total} complete
        </Badge>
        {running > 0 && <span className="text-muted-foreground">{running} running</span>}
        {pending > 0 && <span className="text-muted-foreground">{pending} queued</span>}
        {failed > 0 && <span className="text-destructive">{failed} failed</span>}
        {skipped > 0 && <span className="text-muted-foreground">{skipped} skipped</span>}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Bulk scan progress: ${settled} of ${total} pages complete`}
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const ScoreCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md border border-border bg-muted/30 py-2">
    <div className="text-lg font-semibold">{value}</div>
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
  </div>
);

const CATEGORY_ORDER = ["performance", "accessibility", "seo", "best-practices"] as const;
const CATEGORY_TITLE: Record<string, string> = {
  performance: "Performance",
  accessibility: "Accessibility",
  seo: "SEO",
  "best-practices": "Best practices",
};

/** Estimated savings shown as "~1.2s · ~340 KiB" (whichever Lighthouse gave). */
const savingsLabel = (r: PageAuditRecommendation): string => {
  const parts: string[] = [];
  if (typeof r.savingsMs === "number" && r.savingsMs > 0) parts.push(`~${(r.savingsMs / 1000).toFixed(1)}s`);
  if (typeof r.savingsBytes === "number" && r.savingsBytes > 0)
    parts.push(`~${Math.round(r.savingsBytes / 1024)} KiB`);
  if (parts.length === 0 && r.displayValue) parts.push(r.displayValue);
  return parts.join(" · ");
};

/** Lighthouse descriptions carry markdown links + a trailing "Learn more"; make them plain. */
const cleanDescription = (text: string): string =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s*Learn more.*$/i, "")
    .trim();

const RECS_SHOWN = 5;

/** Order + group recommendations by Lighthouse category (known categories first). */
const groupByCategory = (recs: PageAuditRecommendation[]): [string, PageAuditRecommendation[]][] => {
  const groups = new Map<string, PageAuditRecommendation[]>();
  for (const r of recs) {
    const key = r.category || "other";
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const known = CATEGORY_ORDER.filter((k) => groups.has(k));
  const rest = [...groups.keys()].filter((k) => !CATEGORY_ORDER.includes(k as (typeof CATEGORY_ORDER)[number]));
  return [...known, ...rest].map((k) => [k, groups.get(k)!]);
};

const RecommendationItem: React.FC<{ r: PageAuditRecommendation }> = ({ r }) => {
  const savings = savingsLabel(r);
  const affected = r.affectedCount ?? r.affectedSamples?.length ?? 0;
  return (
    <li className="text-xs">
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 font-medium" title={r.title}>
          {r.title}
        </span>
        {savings && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {savings}
          </span>
        )}
      </div>
      {r.description && (
        <p className="mt-0.5 text-muted-foreground">{cleanDescription(r.description)}</p>
      )}
      {affected > 0 && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {affected} affected element{affected === 1 ? "" : "s"}
          {r.affectedSamples?.length ? (
            <span className="text-muted-foreground/80">: {r.affectedSamples.slice(0, 2).join(", ")}</span>
          ) : null}
        </p>
      )}
    </li>
  );
};

const RecommendationsList: React.FC<{ items: PageAuditRecommendation[] | null }> = ({ items }) => {
  const [expanded, setExpanded] = React.useState(false);
  if (!items || items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, RECS_SHOWN);
  const more = items.length - visible.length;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {items.length} recommendation{items.length === 1 ? "" : "s"}
      </p>
      <div className="space-y-2.5">
        {groupByCategory(visible).map(([cat, recs]) => (
          <div key={cat}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_TITLE[cat] ?? cat}
            </p>
            <ul className="space-y-1.5">
              {recs.map((r) => (
                <RecommendationItem key={r.id} r={r} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {(more > 0 || expanded) && (
        <button
          type="button"
          className="mt-2 text-[11px] font-medium text-primary hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
};

const FIX_CATEGORY: Record<FixCategory, { label: string; variant: "default" | "secondary" | "outline" }> = {
  automatic: { label: "Automatic", variant: "default" },
  one_click: { label: "One-click", variant: "secondary" },
  manual: { label: "Manual", variant: "outline" },
};

/** "Applied 3 draft changes, 2 images queued" — human summary of an apply result. */
const describeResult = (r: ApplyFixResult): string => {
  const parts: string[] = [];
  if (r.applied > 0) parts.push(`${r.applied} draft change${r.applied === 1 ? "" : "s"}`);
  if (r.queued > 0) parts.push(`${r.queued} image${r.queued === 1 ? "" : "s"} queued`);
  return parts.join(", ");
};

/**
 * Per-audit auto-fix panel. Lazily loads the planned fixes when opened and lets
 * the admin apply an automatic / one-click fix (or every automatic fix at once)
 * straight to the page draft, which they review + publish through the normal
 * flow. Image-optimization fixes queue background re-encoding instead.
 */
const FixesPanel: React.FC<{ auditId: string; online?: boolean }> = ({ auditId, online = true }) => {
  const [open, setOpen] = React.useState(false);
  const { data, isLoading, isError } = useAuditFixes(open ? auditId : null);
  const apply = useApplyAuditFix(auditId);
  const applyAll = useApplyAllAutomaticFixes(auditId);
  const busy = apply.isPending || applyAll.isPending;

  const automaticApplicable = (data?.fixes ?? []).filter((f) => f.category === "automatic" && f.applicable);

  const onApply = (fix: AuditFix): void => {
    if (!online) {
      toast.error("You’re offline — fix changes are paused");
      return;
    }
    apply.mutate(fix.ruleId, {
      onSuccess: (r) => {
        const summary = describeResult(r);
        toast.success(summary ? `Applied ${summary} — review & publish` : "Nothing to change");
      },
      onError: () => toast.error("Could not apply fix"),
    });
  };

  const onApplyAll = (): void => {
    if (!online) {
      toast.error("You’re offline — fix changes are paused");
      return;
    }
    applyAll.mutate(undefined, {
      onSuccess: (r) => {
        const summary = describeResult(r);
        toast.success(summary ? `Applied all automatic: ${summary} — review & publish` : "No automatic fixes to apply");
      },
      onError: () => toast.error("Could not apply automatic fixes"),
    });
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        className="text-xs font-medium text-primary hover:underline"
        onClick={() => setOpen((o) => !o)}
      >
        <Wrench className="mr-1 inline h-3 w-3" />
        {open ? "Hide auto-fixes" : "Auto-fixes"}
      </button>

      {open && isLoading && <p className="mt-2 text-xs text-muted-foreground">Loading fixes…</p>}
      {open && isError && (
        <p className="mt-2 text-xs text-muted-foreground">Could not load auto-fixes.</p>
      )}
      {open && data && !data.pageResolved && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          This audit isn&apos;t linked to an editable page, so fixes can&apos;t be applied.
        </p>
      )}
      {open && data && data.pageResolved && data.fixes.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">No auto-fixes available for this page.</p>
      )}
      {open && data && data.fixes.length > 0 && (
        <>
          {automaticApplicable.length > 0 && (
            <div className="mt-2">
              <Button size="sm" disabled={busy || !online} onClick={onApplyAll}>
                <Zap className="mr-1 h-3.5 w-3.5" />
                Apply all automatic ({automaticApplicable.length})
              </Button>
            </div>
          )}
          <ul className="mt-2 space-y-2">
            {data.fixes.map((f) => (
              <li key={f.ruleId} className="rounded-md border border-border p-2 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant={FIX_CATEGORY[f.category].variant} className="shrink-0">
                    {FIX_CATEGORY[f.category].label}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate font-medium" title={f.title}>
                    {f.title}
                  </span>
                  {f.applicable ? (
                    <Button size="sm" variant="outline" disabled={busy || !online} onClick={() => onApply(f)}>
                      Fix {f.changeCount}
                    </Button>
                  ) : (
                    <span className="shrink-0 text-muted-foreground">
                      {f.category === "manual" ? "Manual" : "Nothing to fix"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-muted-foreground">{f.description}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

// --- SITE-HEALTH broken links -----------------------------------------------

const BrokenLinksTab: React.FC = () => {
  const { data, isLoading, isError } = useLinkCheck();
  const run = useRunLinkCheck();
  const runInfo = data?.run ?? null;
  const rows: BrokenLink[] = data?.broken ?? [];

  const onRun = (): void => {
    run.mutate(undefined, {
      onSuccess: () => toast.success("Link check queued — refresh in a moment for results"),
      onError: () => toast.error("Could not queue link check"),
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {runInfo ? (
            <>
              <Badge variant={runInfo.status === "completed" ? "default" : "outline"}>
                {runInfo.status}
              </Badge>
              {runInfo.status === "running" && rows.length > 0 && (
                <span className="text-xs">Showing previous results while check runs…</span>
              )}
              <span>{runInfo.pagesCrawled} pages</span>
              <span>·</span>
              <span>{runInfo.linksChecked} links</span>
              <span>·</span>
              <span
                className={
                  (runInfo.status === "running" ? rows.length : runInfo.brokenCount) > 0
                    ? "font-medium text-destructive"
                    : ""
                }
              >
                {runInfo.status === "running" ? rows.length : runInfo.brokenCount} broken
              </span>
              <span>·</span>
              <span>{fmtWhen(runInfo.finishedAt ?? runInfo.startedAt)}</span>
            </>
          ) : (
            <span>No link check has been run yet.</span>
          )}
        </div>
        <Button
          type="button"
          disabled={run.isPending || runInfo?.status === "running"}
          onClick={onRun}
        >
          <Send className="mr-1 h-3.5 w-3.5" /> Run check
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Source page</th>
              <th className="px-4 py-3 font-medium">Broken URL</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <EmptyRow colSpan={4} text="Loading link check…" />}
            {isError && <EmptyRow colSpan={4} text="Could not load broken links." />}
            {!isLoading && !isError && rows.length === 0 && (
              <EmptyRow
                colSpan={4}
                text={
                  runInfo
                    ? "No broken links found in the latest run."
                    : "Run a check to crawl this site's published pages."
                }
              />
            )}
            {rows.map((b) => (
              <tr key={b.id} className="align-top hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground">{b.sourcePath}</td>
                <td className="max-w-md truncate px-4 py-3" title={b.targetUrl}>
                  {b.targetUrl}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{b.kind}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="destructive">{b.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const EmptyRow: React.FC<{ text: string; colSpan: number }> = ({ text, colSpan }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </td>
  </tr>
);

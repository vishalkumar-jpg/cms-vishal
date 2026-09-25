import { request } from "@/services/AxiosService";

/**
 * Monitoring hub API (#29/#37/#30). All endpoints are header-scoped to the
 * active site (X-Site-Id, injected by AxiosService) — no siteId in the path.
 */

// --- #29 CRM deliveries -----------------------------------------------------

export type CrmDeliveryStatus =
  | "stored"
  | "delivering"
  | "delivered"
  | "failed"
  | "dead_lettered";

export interface CrmDelivery {
  id: string;
  formId: string;
  status: CrmDeliveryStatus;
  deliveryAttempts: number;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
  isSpam: boolean;
}

export interface CrmDeliveryPage {
  rows: CrmDelivery[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

export const listCrmDeliveriesRequest = (params: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<CrmDeliveryPage> =>
  request<CrmDeliveryPage>({
    url: "/monitoring/crm-deliveries",
    method: "GET",
    params: {
      ...(params.status ? { status: params.status } : {}),
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });

export const retryCrmDeliveryRequest = (id: string): Promise<{ enqueued: boolean; jobId: string | null }> =>
  request({ url: `/monitoring/crm-deliveries/${id}/retry`, method: "POST" });

// --- #37 Runtime errors -----------------------------------------------------

export type ErrorSource = "renderer" | "admin" | "api";

export interface RuntimeError {
  id: string;
  source: ErrorSource;
  message: string;
  stack: string | null;
  url: string | null;
  userAgent: string | null;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export interface RuntimeErrorPage {
  rows: RuntimeError[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

export const listErrorsRequest = (params: {
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<RuntimeErrorPage> =>
  request<RuntimeErrorPage>({
    url: "/monitoring/errors",
    method: "GET",
    params: {
      ...(params.source ? { source: params.source } : {}),
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });

// --- #30 Page audits --------------------------------------------------------

export type PageAuditStatus =
  | "seam"
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export interface PageAuditRecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  score: number | null;
  displayValue?: string;
  savingsMs?: number;
  savingsBytes?: number;
  /** Number of affected elements (from the LHR audit details). */
  affectedCount?: number;
  /** A small sample of affected element identifiers (urls / selectors). */
  affectedSamples?: string[];
}

export interface PageAudit {
  id: string;
  pageId: string | null;
  path: string;
  status: PageAuditStatus;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  lcp: number | null;
  cls: number | null;
  recommendations: PageAuditRecommendation[] | null;
  batchId: string | null;
  /** Failure/skip reason from the worker (null when completed). */
  detail: string | null;
  ranAt: string;
}

export interface PageAuditPage {
  rows: PageAudit[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface AuditBatchProgress {
  batchId: string;
  total: number;
  completed: number;
  running: number;
  pending: number;
  failed: number;
  skipped: number;
  rows: PageAudit[];
}

export interface AuditsQuery {
  path?: string;
  status?: string;
  /** ISO timestamp — only audits ran at/after this. */
  from?: string;
  /** ISO timestamp — only audits ran at/before this. */
  to?: string;
  limit?: number;
  offset?: number;
}

export const listAuditsRequest = (params: AuditsQuery): Promise<PageAuditPage> =>
  request<PageAuditPage>({
    url: "/monitoring/audits",
    method: "GET",
    params: {
      ...(params.path ? { path: params.path } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.from ? { from: params.from } : {}),
      ...(params.to ? { to: params.to } : {}),
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });

// --- #30 PageSpeed dashboard rollup -----------------------------------------

export interface AuditScores {
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
}

export interface DashboardPage extends AuditScores {
  auditId: string;
  pageId: string | null;
  path: string;
  status: PageAuditStatus;
  lcp: number | null;
  cls: number | null;
  ranAt: string;
  average: number | null;
  previous: (AuditScores & { average: number | null; ranAt: string }) | null;
  flaggedCategories: string[];
  /** Scan wall-clock (ms), derived from createdAt→ranAt. Null until completed. */
  durationMs: number | null;
}

// --- Phase 5: schedule, alerts, regressions --------------------------------

export interface AuditSchedule {
  enabled: boolean;
  frequency: "daily" | "weekly";
  hour?: number;
  dayOfWeek?: number;
  /** Set by the worker sweep; read-only from the admin. */
  lastScheduledScanAt?: string;
}

export interface AuditAlerts {
  enabled: boolean;
  performance?: number;
  accessibility?: number;
  seo?: number;
  bestPractices?: number;
  lcpMs?: number;
  cls?: number;
}

export interface PageAuditConfig {
  schedule?: AuditSchedule;
  alerts?: AuditAlerts;
}

export interface PageAuditAlertBreach {
  metric: string;
  value: number | null;
  threshold: number;
  lowerIsBetter: boolean;
}

export interface PageAuditAlert {
  path: string;
  auditId: string;
  breaches: PageAuditAlertBreach[];
}

export interface RegressionPage {
  path: string;
  auditId: string;
  average: number | null;
  previousAverage: number | null;
  delta: number;
}

export interface AuditRegressions {
  largestDrops: RegressionPage[];
  newlyFailing: RegressionPage[];
  improving: RegressionPage[];
}

export interface AuditDashboardSummary {
  health: number | null;
  previousHealth: number | null;
  averages: AuditScores;
  counts: {
    pages: number;
    completed: number;
    running: number;
    pending: number;
    failed: number;
    skipped: number;
  };
  best: DashboardPage[];
  worst: DashboardPage[];
  pages: DashboardPage[];
  lastScanAt: string | null;
  avgScanDurationMs: number | null;
  lastScanDurationMs: number | null;
  schedule: AuditSchedule | null;
  nextScanAt: string | null;
  alerts: AuditAlerts | null;
  alertingPages: PageAuditAlert[];
  regressions: AuditRegressions;
}

export const getAuditSummaryRequest = (): Promise<AuditDashboardSummary> =>
  request<AuditDashboardSummary>({ url: "/monitoring/audits/summary", method: "GET" });

export const getAuditConfigRequest = (): Promise<PageAuditConfig> =>
  request<PageAuditConfig>({ url: "/monitoring/audits/config", method: "GET" });

export const updateAuditConfigRequest = (
  payload: PageAuditConfig,
): Promise<PageAuditConfig> =>
  request<PageAuditConfig>({ url: "/monitoring/audits/config", method: "PUT", data: payload });

export const runAuditRequest = (payload: { path: string; pageId?: string }): Promise<PageAudit> =>
  request<PageAudit>({ url: "/monitoring/audits/run", method: "POST", data: payload });

export const scanAllAuditsRequest = (): Promise<{ batchId: string; queued: number }> =>
  request<{ batchId: string; queued: number }>({ url: "/monitoring/audits/scan-all", method: "POST" });

export const getAuditBatchRequest = (batchId: string): Promise<AuditBatchProgress> =>
  request<AuditBatchProgress>({ url: `/monitoring/audits/batch/${batchId}`, method: "GET" });

// --- #30 PageSpeed auto-fixes (Phase 2) -------------------------------------

export type FixCategory = "automatic" | "one_click" | "manual";

export interface AuditFixChange {
  nodeId: string;
  field: string;
  before: unknown;
  after: unknown;
  summary: string;
}

export interface AuditFix {
  ruleId: string;
  category: FixCategory;
  title: string;
  description: string;
  changeCount: number;
  applicable: boolean;
  changes: AuditFixChange[];
}

export interface AuditFixes {
  auditId: string;
  pageId: string | null;
  pageResolved: boolean;
  fixes: AuditFix[];
}

export interface ApplyFixResult {
  /** Layout prop changes written to the page draft. */
  applied: number;
  /** Images queued for re-encoding via the image pipeline. */
  queued: number;
  pageId: string | null;
  /** The rule ids that produced work. */
  ruleIds: string[];
}

export const previewAuditFixesRequest = (auditId: string): Promise<AuditFixes> =>
  request<AuditFixes>({ url: `/monitoring/audits/${auditId}/fixes`, method: "GET" });

export const applyAuditFixRequest = (auditId: string, ruleId: string): Promise<ApplyFixResult> =>
  request<ApplyFixResult>({ url: `/monitoring/audits/${auditId}/fixes/${ruleId}/apply`, method: "POST" });

export const applyAllAutomaticFixesRequest = (auditId: string): Promise<ApplyFixResult> =>
  request<ApplyFixResult>({
    url: `/monitoring/audits/${auditId}/fixes/apply-automatic`,
    method: "POST",
  });

// --- SITE-HEALTH broken links -----------------------------------------------

export type LinkCheckStatus = "running" | "completed" | "failed";
export type BrokenLinkKind = "internal" | "external";

export interface LinkCheckRun {
  id: string;
  status: LinkCheckStatus;
  pagesCrawled: number;
  linksChecked: number;
  brokenCount: number;
  detail: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface BrokenLink {
  id: string;
  runId: string;
  sourcePath: string;
  targetUrl: string;
  kind: BrokenLinkKind;
  status: string;
  checkedAt: string;
}

export interface LinkCheckResult {
  run: LinkCheckRun | null;
  broken: BrokenLink[];
  limit: number;
  offset: number;
}

export const getLinkCheckRequest = (): Promise<LinkCheckResult> =>
  request<LinkCheckResult>({ url: "/monitoring/links", method: "GET" });

export const runLinkCheckRequest = (): Promise<LinkCheckRun> =>
  request<LinkCheckRun>({ url: "/monitoring/links/check", method: "POST" });

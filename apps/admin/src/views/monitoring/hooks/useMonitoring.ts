import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  applyAllAutomaticFixesRequest,
  applyAuditFixRequest,
  getAuditBatchRequest,
  getAuditConfigRequest,
  getAuditSummaryRequest,
  getLinkCheckRequest,
  listAuditsRequest,
  listCrmDeliveriesRequest,
  listErrorsRequest,
  previewAuditFixesRequest,
  retryCrmDeliveryRequest,
  runAuditRequest,
  runLinkCheckRequest,
  scanAllAuditsRequest,
  updateAuditConfigRequest,
  type ApplyFixResult,
  type AuditBatchProgress,
  type AuditDashboardSummary,
  type AuditFixes,
  type AuditsQuery,
  type CrmDeliveryPage,
  type LinkCheckResult,
  type LinkCheckRun,
  type PageAudit,
  type PageAuditConfig,
  type PageAuditPage,
  type RuntimeErrorPage,
} from "../api/monitoring.api";

/** Wrapped Monitoring hooks. All monitoring server access goes through these. */

// --- #29 CRM deliveries -----------------------------------------------------

export const useCrmDeliveries = (status: string | undefined) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<CrmDeliveryPage>({
    queryKey: [ADMIN_QUERY_KEYS.CRM_DELIVERIES, siteId, status ?? ""],
    queryFn: () => listCrmDeliveriesRequest({ status }),
    enabled: !!siteId,
  });
};

export const useRetryCrmDelivery = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ enqueued: boolean; jobId: string | null }, unknown, string>({
    mutationFn: (id) => retryCrmDeliveryRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.CRM_DELIVERIES, siteId] }),
  });
};

// --- #37 Runtime errors -----------------------------------------------------

export const useRuntimeErrors = (source: string | undefined) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<RuntimeErrorPage>({
    queryKey: [ADMIN_QUERY_KEYS.RUNTIME_ERRORS, siteId, source ?? ""],
    queryFn: () => listErrorsRequest({ source }),
    enabled: !!siteId,
  });
};

// --- #30 Page audits --------------------------------------------------------

/**
 * List page audits, optionally scoped to one path + status + a ranAt date range
 * (powers the Scan History view's filters). `query` is part of the cache key so
 * changing filters refetches.
 */
export const usePageAudits = (query: AuditsQuery = {}) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { path = "", status = "", from = "", to = "" } = query;
  return useQuery<PageAuditPage>({
    queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "list", path, status, from, to],
    queryFn: () => listAuditsRequest(query),
    enabled: !!siteId,
  });
};

/** Site-wide PageSpeed dashboard rollup (health, averages, best/worst, trends). */
export const useAuditDashboard = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<AuditDashboardSummary>({
    queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "summary"],
    queryFn: () => getAuditSummaryRequest(),
    enabled: !!siteId,
  });
};

/** Read the site's scheduled-scan + performance-alert config (Phase 5). */
export const useAuditConfig = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<PageAuditConfig>({
    queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "config"],
    queryFn: () => getAuditConfigRequest(),
    enabled: !!siteId,
  });
};

/** Update the schedule + alert config, then refresh the config + dashboard. */
export const useUpdateAuditConfig = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<PageAuditConfig, unknown, PageAuditConfig>({
    mutationFn: (payload) => updateAuditConfigRequest(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "config"] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "summary"] });
    },
  });
};

export const useRunAudit = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<PageAudit, unknown, { path: string; pageId?: string }>({
    mutationFn: (payload) => runAuditRequest(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "summary"] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "list"] });
    },
  });
};

export const useScanAllAudits = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ batchId: string; queued: number }, unknown, void>({
    mutationFn: () => scanAllAuditsRequest(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "summary"] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "list"] });
    },
  });
};

/**
 * Poll a bulk-scan batch's progress. Auto-refetches every 4s while any row is
 * still `pending`, then stops. Disabled when no batch is active.
 */
export const useAuditBatch = (batchId: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<AuditBatchProgress>({
    queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "batch", batchId ?? ""],
    queryFn: () => getAuditBatchRequest(batchId as string),
    enabled: !!siteId && !!batchId,
    // Keep polling while any row is still queued OR actively running.
    refetchInterval: (query) => {
      const d = query.state.data;
      return d && (d.pending > 0 || d.running > 0) ? 4000 : false;
    },
  });
};

/**
 * Preview the auto-fixes available for one audit (planned against the current
 * page draft). Lazy: pass `null` to keep it disabled until the user opens the
 * fixes panel.
 */
export const useAuditFixes = (auditId: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<AuditFixes>({
    queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "fixes", auditId ?? ""],
    queryFn: () => previewAuditFixesRequest(auditId as string),
    enabled: !!siteId && !!auditId,
  });
};

/** Invalidate audit list + dashboard after a fix is applied. */
const invalidateAuditFixes = (
  qc: ReturnType<typeof useQueryClient>,
  siteId: string | null,
  auditId: string,
): void => {
  void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "fixes", auditId] });
  void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "summary"] });
  void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE_AUDITS, siteId, "list"] });
};

/** Apply one auto-fix to the audit's page draft, then refresh its fix preview. */
export const useApplyAuditFix = (auditId: string) => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<ApplyFixResult, unknown, string>({
    mutationFn: (ruleId) => applyAuditFixRequest(auditId, ruleId),
    onSuccess: () => invalidateAuditFixes(qc, siteId, auditId),
  });
};

/** Apply every automatic fix flagged on the audit, then refresh its fix preview. */
export const useApplyAllAutomaticFixes = (auditId: string) => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<ApplyFixResult, unknown, void>({
    mutationFn: () => applyAllAutomaticFixesRequest(auditId),
    onSuccess: () => invalidateAuditFixes(qc, siteId, auditId),
  });
};

// --- SITE-HEALTH broken links -----------------------------------------------

export const useLinkCheck = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<LinkCheckResult>({
    queryKey: [ADMIN_QUERY_KEYS.BROKEN_LINKS, siteId],
    queryFn: () => getLinkCheckRequest(),
    enabled: !!siteId,
    refetchInterval: (query) =>
      query.state.data?.run?.status === "running" ? 4000 : false,
  });
};

export const useRunLinkCheck = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<LinkCheckRun, unknown, void>({
    mutationFn: () => runLinkCheckRequest(),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.BROKEN_LINKS, siteId] }),
  });
};

import { useMutation, useQuery } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { listAuditRequest, type AuditPage } from "@/views/audit/api/audit.api";
import {
  consentRecordsRequest,
  dsarEraseRequest,
  dsarExportRequest,
  dsarSummaryRequest,
  type ConsentRecord,
  type DsarErasure,
  type DsarExport,
  type DsarSummary,
} from "../api/privacy.api";

/** Look up a subject's data summary (email or visitorId). Enabled on demand. */
export const useDsarSummary = (query: string, enabled: boolean) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<DsarSummary>({
    queryKey: [ADMIN_QUERY_KEYS.DSAR_SUBJECT, siteId, query],
    queryFn: () => dsarSummaryRequest(query),
    enabled: enabled && !!siteId && query.trim().length > 0,
    retry: false,
  });
};

/** Fetch the full JSON export (triggered by the Export button). */
export const useDsarExport = () =>
  useMutation<DsarExport, unknown, string>({
    mutationFn: (query) => dsarExportRequest(query),
  });

/** Erase/anonymize a subject's data (destructive; confirmed in the UI). */
export const useDsarErase = () =>
  useMutation<DsarErasure, unknown, string>({
    mutationFn: (query) => dsarEraseRequest(query),
  });

/** Recent proof-of-consent records for the active site. */
export const useConsentRecords = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<ConsentRecord[]>({
    queryKey: [ADMIN_QUERY_KEYS.CONSENT_RECORDS, siteId],
    queryFn: () => consentRecordsRequest(siteId as string, 25),
    enabled: !!siteId,
  });
};

/** Recent DSAR erasure actions from the audit log (entityType = dsar_subject). */
export const useDsarAudit = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<AuditPage>({
    queryKey: [ADMIN_QUERY_KEYS.AUDIT, siteId, "privacy.dsar_erased", "dsar_subject"],
    queryFn: () =>
      listAuditRequest(siteId as string, { entityType: "dsar_subject", limit: 20, offset: 0 }),
    enabled: !!siteId,
  });
};

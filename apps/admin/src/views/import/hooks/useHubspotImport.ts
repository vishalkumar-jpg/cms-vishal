import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  previewHubspotRequest,
  runHubspotExportRequest,
  runHubspotRequest,
} from "../api/import.api";
import type {
  HubspotExportItem,
  HubspotPreview,
  ImportSummary,
  RunImportPayload,
} from "../types";

/** Wrapped HubSpot-import hooks. All import server access goes through these. */

export const usePreviewHubspot = () =>
  useMutation<HubspotPreview, unknown, { token: string }>({
    mutationFn: ({ token }) => previewHubspotRequest(token),
  });

/** Invalidate the Pages + Posts lists so imported drafts show up immediately. */
const useInvalidateContent = (): (() => void) => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return () => {
    void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] });
    void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] });
  };
};

export const useRunHubspotImport = () => {
  const invalidate = useInvalidateContent();
  return useMutation<ImportSummary, unknown, RunImportPayload>({
    mutationFn: (payload) => runHubspotRequest(payload),
    onSuccess: invalidate,
  });
};

export const useRunHubspotExport = () => {
  const invalidate = useInvalidateContent();
  return useMutation<ImportSummary, unknown, { items: HubspotExportItem[] }>({
    mutationFn: ({ items }) => runHubspotExportRequest(items),
    onSuccess: invalidate,
  });
};

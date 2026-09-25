import { request } from "@/services/AxiosService";
import type {
  HubspotExportItem,
  HubspotPreview,
  ImportSummary,
  RunImportPayload,
} from "../types";

/**
 * Raw HubSpot-import API calls. Site-scoped via the X-Site-Id header (Axios
 * mutator), so paths are relative: `/hubspot-import/*`. The token is passed in
 * the request body and is never stored client-side.
 */
export const previewHubspotRequest = (token: string): Promise<HubspotPreview> =>
  request<HubspotPreview>({ url: `/hubspot-import/preview`, method: "POST", data: { token } });

export const runHubspotRequest = (payload: RunImportPayload): Promise<ImportSummary> =>
  request<ImportSummary>({ url: `/hubspot-import/run`, method: "POST", data: payload });

export const runHubspotExportRequest = (
  items: HubspotExportItem[],
): Promise<ImportSummary> =>
  request<ImportSummary>({
    url: `/hubspot-import/run-export`,
    method: "POST",
    data: { items },
  });

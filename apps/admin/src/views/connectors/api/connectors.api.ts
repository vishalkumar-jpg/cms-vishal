import { API_PREFIX } from "@ob-cms/shared";
import { request } from "@/services/AxiosService";
import type {
  ConnectConnectorPayload,
  ConnectorCatalogItem,
  ConnectorConnection,
  ConnectorImportRunResponse,
  HubspotScopedImportPreview,
  ImportRun,
} from "../types";

export const listConnectorsRequest = (): Promise<ConnectorCatalogItem[]> =>
  request<ConnectorCatalogItem[]>({ url: `${API_PREFIX}/connectors`, method: "GET" });

export const listConnectionsRequest = (): Promise<ConnectorConnection[]> =>
  request<ConnectorConnection[]>({ url: `${API_PREFIX}/connectors/connections`, method: "GET" });

export const createConnectionRequest = (
  connectorId: string,
  payload: ConnectConnectorPayload,
): Promise<ConnectorConnection> =>
  request<ConnectorConnection>({
    url: `${API_PREFIX}/connectors/${connectorId}/connections`,
    method: "POST",
    data: payload,
  });

export const disconnectConnectionRequest = (
  connectionId: string,
): Promise<ConnectorConnection> =>
  request<ConnectorConnection>({
    url: `${API_PREFIX}/connectors/connections/${connectionId}/disconnect`,
    method: "POST",
  });

export const listImportRunsRequest = (
  connectionId?: string,
  limit?: number,
): Promise<ImportRun[]> =>
  request<ImportRun[]>({
    url: `${API_PREFIX}/connectors/import-runs`,
    method: "GET",
    params: {
      ...(connectionId ? { connectionId } : {}),
      ...(limit !== undefined ? { limit: String(limit) } : {}),
    },
  });

export const previewImportRequest = (
  connectionId: string,
  scope: string,
): Promise<HubspotScopedImportPreview> =>
  request<HubspotScopedImportPreview>({
    url: `${API_PREFIX}/connectors/connections/${connectionId}/import-preview`,
    method: "GET",
    params: { scope },
  });

export const runImportRequest = (
  connectionId: string,
  scope: string,
): Promise<ConnectorImportRunResponse> =>
  request<ConnectorImportRunResponse>({
    url: `${API_PREFIX}/connectors/connections/${connectionId}/import`,
    method: "POST",
    data: { scope },
  });

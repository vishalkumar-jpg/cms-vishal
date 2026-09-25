import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  createConnectionRequest,
  disconnectConnectionRequest,
  listConnectionsRequest,
  listConnectorsRequest,
  listImportRunsRequest,
  previewImportRequest,
  runImportRequest,
} from "../api/connectors.api";
import { CONNECTOR_IMPORT_RUNS_LIST_LIMIT } from "../constants";
import type {
  ConnectConnectorPayload,
  ConnectorCatalogItem,
  ConnectorConnection,
  ConnectorImportRunResponse,
  HubspotScopedImportPreview,
  ImportRun,
} from "../types";

export const useConnectorsCatalog = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<ConnectorCatalogItem[]>({
    queryKey: [ADMIN_QUERY_KEYS.CONNECTORS, siteId],
    queryFn: () => listConnectorsRequest(),
    enabled: !!siteId,
  });
};

export const useConnections = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<ConnectorConnection[]>({
    queryKey: [ADMIN_QUERY_KEYS.CONNECTOR_CONNECTIONS, siteId],
    queryFn: () => listConnectionsRequest(),
    enabled: !!siteId,
  });
};

export const useImportRuns = (
  connectionId: string | undefined,
  options?: { enabled?: boolean },
) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const scoped = connectionId != null && connectionId.trim() !== "";
  const enabled = !!siteId && scoped && (options?.enabled ?? true);
  return useQuery<ImportRun[]>({
    queryKey: [ADMIN_QUERY_KEYS.CONNECTOR_IMPORT_RUNS, siteId, connectionId ?? ""],
    queryFn: () => listImportRunsRequest(connectionId, CONNECTOR_IMPORT_RUNS_LIST_LIMIT),
    enabled,
  });
};

export const useCreateConnection = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<
    ConnectorConnection,
    unknown,
    { connectorId: string; payload: ConnectConnectorPayload }
  >({
    mutationFn: ({ connectorId, payload }) => createConnectionRequest(connectorId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.CONNECTORS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.CONNECTOR_CONNECTIONS, siteId] });
    },
  });
};

export const useDisconnectConnection = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<ConnectorConnection, unknown, string>({
    mutationFn: (connectionId) => disconnectConnectionRequest(connectionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.CONNECTORS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.CONNECTOR_CONNECTIONS, siteId] });
    },
  });
};

export const usePreviewImport = () =>
  useMutation<HubspotScopedImportPreview, unknown, { connectionId: string; scope: string }>({
    mutationFn: ({ connectionId, scope }) => previewImportRequest(connectionId, scope),
  });

export const useRunImport = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<ConnectorImportRunResponse, unknown, { connectionId: string; scope: string }>(
    {
      mutationFn: ({ connectionId, scope }) => runImportRequest(connectionId, scope),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.CONNECTOR_IMPORT_RUNS, siteId] });
        void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] });
        void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] });
      },
    },
  );
};

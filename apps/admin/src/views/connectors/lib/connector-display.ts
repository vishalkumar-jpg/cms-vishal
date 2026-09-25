import {
  CONNECTION_STATUS_CONNECTED,
  CONNECTION_STATUS_NOT_CONNECTED,
  CONNECTOR_METADATA_LABELS,
} from "../constants";
import type { ConnectorCatalogItem, ConnectorConnection } from "../types";

export type ConnectionStatusBadgeVariant = "success" | "muted";

export const getConnectionStatusBadge = (
  connection: ConnectorConnection,
): { label: string; variant: ConnectionStatusBadgeVariant } => ({
  label: connection.connected ? CONNECTION_STATUS_CONNECTED : CONNECTION_STATUS_NOT_CONNECTED,
  variant: connection.connected ? "success" : "muted",
});

export const formatConnectorDate = (value: string | null): string | null => {
  if (!value) return null;
  return new Date(value).toLocaleString();
};

export const getConnectionAccountLabel = (connection: ConnectorConnection): string => {
  if (connection.accountLabel) return connection.accountLabel;
  if (connection.accountId) return connection.accountId;
  return "—";
};

export const getConnectorCategory = (
  item: ConnectorCatalogItem | ConnectorConnection,
): string => item.category ?? "Integration";

export const getConnectionIdentityFields = (
  connection: ConnectorConnection,
): Array<{ label: string; value: string }> => {
  const fields: Array<{ label: string; value: string }> = [];

  if (connection.accountLabel) {
    fields.push({ label: "Account", value: connection.accountLabel });
  }
  if (connection.accountId) {
    fields.push({ label: "Account ID", value: connection.accountId });
  }

  for (const [key, rawValue] of Object.entries(connection.metadata)) {
    if (rawValue == null || typeof rawValue === "object") continue;
    const value = String(rawValue);
    if (!value || key === "accountLabel") continue;
    if (key === "portalId" && connection.accountId === value) continue;
    fields.push({
      label: CONNECTOR_METADATA_LABELS[key] ?? key,
      value,
    });
  }

  return fields;
};

import { CONNECTOR_CAPABILITY, connectorHasCapability } from "@ob-cms/block-schema";
import type { ConnectorCatalogItem, ConnectorConnection } from "../types";

export const connectionSupportsImport = (
  connection: ConnectorConnection,
  catalog: ConnectorCatalogItem[],
): boolean => {
  const definition = catalog.find((item) => item.id === connection.connectorId);
  return connectorHasCapability(definition?.capabilities, CONNECTOR_CAPABILITY.IMPORT);
};

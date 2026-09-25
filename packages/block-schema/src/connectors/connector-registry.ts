import { ConnectorAdapter, ConnectorDefinition } from "./connector-adapter";
import { HUBSPOT_CONNECTOR_ID, HubspotAdapter } from "./hubspot/hubspot-adapter";

const registry = new Map<string, ConnectorAdapter>([
  [HUBSPOT_CONNECTOR_ID, new HubspotAdapter()],
]);

export const getConnector = (id: string): ConnectorAdapter | undefined => registry.get(id);

export const listConnectors = (): ConnectorDefinition[] =>
  Array.from(registry.values()).map((adapter) => adapter.definition);

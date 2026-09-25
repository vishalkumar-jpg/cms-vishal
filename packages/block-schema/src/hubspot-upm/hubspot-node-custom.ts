import type { HubspotSourceNode } from "./types";

export const HUBSPOT_LAYOUT_CUSTOM_KEY = "hubspot" as const;

export const buildHubspotNodeCustom = (
  node: HubspotSourceNode,
  conversionRole: string,
): Record<string, unknown> => ({
  [HUBSPOT_LAYOUT_CUSTOM_KEY]: {
    sourcePath: node.sourcePath,
    hsId: node.provenance.hubspotHsId,
    nodeKind: node.nodeKind,
    moduleId: node.hubspot?.moduleId,
    moduleType: node.hubspot?.moduleType,
    conversionRole,
  },
});

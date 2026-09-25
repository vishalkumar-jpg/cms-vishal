/** Generic connector capability tokens referenced by Admin and API. */
export const CONNECTOR_CAPABILITY = {
  IMPORT: "import",
  VIEW_IMPORTED_CONTENT: "view-imported-content",
} as const;

export type ConnectorCapabilityToken =
  (typeof CONNECTOR_CAPABILITY)[keyof typeof CONNECTOR_CAPABILITY];

export const connectorHasCapability = (
  capabilities: string[] | undefined,
  capability: string,
): boolean => (capabilities ?? []).includes(capability);

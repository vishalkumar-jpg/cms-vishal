export { getConnector, listConnectors } from "./connector-registry";

export {
  normalizeConnectorConfiguration,
  parseConnectorCredentials,
  pickCredentialHintSource,
  resolveCredentialKeys,
  serializeConnectorCredentials,
  stripSecretKeysFromMetadata,
  validateRequiredConfigurationFields,
} from "./connector-credentials";

export {
  CONNECTOR_CAPABILITY,
  connectorHasCapability,
  type ConnectorCapabilityToken,
} from "./connector-capabilities";

export type {
  ConnectorAdapter,
  ConnectorConfiguration,
  ConnectorConfigurationField,
  ConnectorConfigurationFieldType,
  ConnectorConfigurationType,
  ConnectorDefinition,
  ConnectorStatus,
  ConnectorValidationResult,
} from "./connector-adapter";

export { assertHubspotImportTokenAllowed } from "./hubspot/hubspot-import-token-guard";
export {
  HubspotAdapter,
  HUBSPOT_CONNECTOR_DEFINITION,
  HUBSPOT_CONNECTOR_ID,
  HUBSPOT_PORTAL_INFO_API_PATH,
} from "./hubspot/hubspot-adapter";

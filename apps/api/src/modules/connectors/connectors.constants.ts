import { HUBSPOT_CONNECTOR_ID } from "@ob-cms/block-schema";

/** Minimum length for connector credentials (HubSpot private-app tokens). */
export const CONNECTOR_CREDENTIAL_MIN_LENGTH = 8;

export const CONNECTOR_AUDIT_ACTIONS = {
  CONNECTED: "connector.connected",
  DISCONNECTED: "connector.disconnected",
} as const;

export const CONNECTOR_AUDIT_ENTITY_TYPE = "connector_connection";

/** PostgreSQL unique index from migration 0044 (site + connector + account). */
export const CONNECTOR_CONNECTION_ACCOUNT_UNIQUE_INDEX = "ccn_site_connector_account_uq";

/** PostgreSQL `unique_violation` SQLSTATE. */
export const POSTGRES_UNIQUE_VIOLATION_CODE = "23505";

export const IMPORT_RUNS_LIST_DEFAULT_LIMIT = 50;
export const IMPORT_RUNS_LIST_MAX_LIMIT = 200;

/** Observability key for scoped HubSpot import runs (connection + scope). */
export const buildHubspotImportCorrelationKey = (
  connectionId: string,
  scope: string,
): string => `${HUBSPOT_CONNECTOR_ID}:${connectionId}:${scope}`;

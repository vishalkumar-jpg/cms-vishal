import { sql } from "drizzle-orm";
import { boolean, index, jsonb, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

const CONNECTOR_CONNECTION_SITE_ID_LENGTH = 50;
const CONNECTOR_CONNECTION_CONNECTOR_ID_LENGTH = 50;
const CONNECTOR_CONNECTION_ACCOUNT_ID_LENGTH = 50;
const CONNECTOR_CONNECTION_ENCRYPTED_CREDENTIALS_LENGTH = 2000;
const CONNECTOR_CONNECTION_CREDENTIAL_HINT_LENGTH = 40;

/**
 * `connector_connections` (prefix `ccn`) — encrypted provider account connections
 * for a site. A site may have many connections per connector (e.g. multiple
 * HubSpot portals). Private credentials are encrypted at rest; only
 * `credentialHint` is ever returned to Admin.
 */
export const connectorConnections = obCmsSchema.table(
  "connector_connections",
  {
    ...baseColumns("ccn"),
    siteId: varchar({ length: CONNECTOR_CONNECTION_SITE_ID_LENGTH })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    connectorId: varchar({ length: CONNECTOR_CONNECTION_CONNECTOR_ID_LENGTH }).notNull(),
    /** Provider-neutral account identifier (e.g. HubSpot portal id). */
    accountId: varchar({ length: CONNECTOR_CONNECTION_ACCOUNT_ID_LENGTH }),
    encryptedCredentials: varchar({
      length: CONNECTOR_CONNECTION_ENCRYPTED_CREDENTIALS_LENGTH,
    }).notNull(),
    credentialHint: varchar({ length: CONNECTOR_CONNECTION_CREDENTIAL_HINT_LENGTH }).notNull(),
    /** Provider-specific non-secret fields (e.g. HubSpot portalId/hubId/accountLabel). */
    metadata: jsonb().notNull().default({}),
    isConnected: boolean().notNull().default(true),
    connectedAt: timestamp({ withTimezone: true }),
    lastValidatedAt: timestamp({ withTimezone: true }),
    lastSyncAt: timestamp({ withTimezone: true }),
    /** When false, automated sync worker skips this site for this connector. */
    syncEnabled: boolean().notNull().default(true),
    syncState: jsonb().notNull().default({}),
  },
  (t) => [
    uniqueIndex("ccn_site_connector_account_uq")
      .on(t.siteId, t.connectorId, t.accountId)
      .where(sql`deleted_at IS NULL AND account_id IS NOT NULL`),
    index("ccn_site_connector_idx").on(t.siteId, t.connectorId),
    index("ccn_site_idx").on(t.siteId),
  ],
);

export type ConnectorConnectionRow = typeof connectorConnections.$inferSelect;
export type NewConnectorConnectionRow = typeof connectorConnections.$inferInsert;

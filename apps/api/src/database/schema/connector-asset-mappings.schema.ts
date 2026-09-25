import { sql } from "drizzle-orm";
import { bigint, index, jsonb, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { connectorConnections } from "./connector-connections.schema";
import { media } from "./media.schema";
import { sites } from "./sites.schema";

export const CONNECTOR_ASSET_MAPPING_STATUSES = ["ready", "failed"] as const;
export type ConnectorAssetMappingStatus = (typeof CONNECTOR_ASSET_MAPPING_STATUSES)[number];

export const connectorAssetMappings = obCmsSchema.table(
  "connector_asset_mappings",
  {
    ...baseColumns("cam"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    connectionId: varchar({ length: 50 })
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    sourceSystem: varchar({ length: 30 }).notNull(),
    identityKey: varchar({ length: 500 }).notNull(),
    sourceUrl: varchar({ length: 2000 }).notNull(),
    hubspotFileId: varchar({ length: 200 }),
    discoveredAtPath: varchar({ length: 500 }),
    mediaId: varchar({ length: 50 }).references(() => media.id, { onDelete: "set null" }),
    obUrl: varchar({ length: 1000 }),
    status: varchar({ length: 20 }).notNull().$type<ConnectorAssetMappingStatus>(),
    contentType: varchar({ length: 100 }),
    byteSize: bigint({ mode: "number" }),
    checksumSha256: varchar({ length: 64 }),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    error: varchar({ length: 2000 }),
  },
  (t) => [
    uniqueIndex("cam_site_connection_identity_active_uidx")
      .on(t.siteId, t.connectionId, t.identityKey)
      .where(sql`deleted_at IS NULL`),
    index("cam_connection_idx").on(t.connectionId),
  ],
);

export type ConnectorAssetMappingRow = typeof connectorAssetMappings.$inferSelect;
export type NewConnectorAssetMappingRow = typeof connectorAssetMappings.$inferInsert;

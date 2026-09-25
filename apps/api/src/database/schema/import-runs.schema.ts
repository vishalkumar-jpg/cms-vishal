import { index, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { connectorConnections } from "./connector-connections.schema";
import { sites } from "./sites.schema";

export const IMPORT_RUN_STATUSES = ["running", "succeeded", "failed"] as const;
export type ImportRunStatus = (typeof IMPORT_RUN_STATUSES)[number];

const IMPORT_RUN_SITE_ID_LENGTH = 50;
const IMPORT_RUN_CONNECTION_ID_LENGTH = 50;
const IMPORT_RUN_CONNECTOR_ID_LENGTH = 50;
const IMPORT_RUN_ACCOUNT_ID_LENGTH = 50;
const IMPORT_RUN_ACCOUNT_LABEL_LENGTH = 200;
const IMPORT_RUN_SCOPE_LENGTH = 20;
const IMPORT_RUN_STATUS_LENGTH = 20;
export const IMPORT_RUN_ERROR_LENGTH = 2000;
const IMPORT_RUN_CORRELATION_KEY_LENGTH = 100;

/** Persisted summary aligned with HubSpot `ImportSummary` (provider-neutral jsonb). */
export type ImportRunResultSummary = {
  importedPages: number;
  importedPosts: number;
  /** Re-import updates to existing HubSpot-linked entities (optional for older rows). */
  updatedPages?: number;
  updatedPosts?: number;
  skipped: { name: string; reason: string }[];
};

/**
 * `import_runs` (prefix `imr`) — durable history of connection-scoped content
 * imports. Credentials never appear on this table.
 */
export const importRuns = obCmsSchema.table(
  "import_runs",
  {
    ...baseColumns("imr"),
    siteId: varchar({ length: IMPORT_RUN_SITE_ID_LENGTH })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    connectionId: varchar({ length: IMPORT_RUN_CONNECTION_ID_LENGTH })
      .notNull()
      .references(() => connectorConnections.id, { onDelete: "cascade" }),
    connectorId: varchar({ length: IMPORT_RUN_CONNECTOR_ID_LENGTH }).notNull(),
    accountId: varchar({ length: IMPORT_RUN_ACCOUNT_ID_LENGTH }),
    accountLabel: varchar({ length: IMPORT_RUN_ACCOUNT_LABEL_LENGTH }),
    scope: varchar({ length: IMPORT_RUN_SCOPE_LENGTH }).notNull(),
    status: varchar({ length: IMPORT_RUN_STATUS_LENGTH })
      .$type<ImportRunStatus>()
      .notNull()
      .default("running"),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    completedAt: timestamp({ withTimezone: true }),
    resultSummary: jsonb().$type<ImportRunResultSummary>().notNull().default({
      importedPages: 0,
      importedPosts: 0,
      skipped: [],
    }),
    errorMessage: varchar({ length: IMPORT_RUN_ERROR_LENGTH }),
    correlationKey: varchar({ length: IMPORT_RUN_CORRELATION_KEY_LENGTH }),
  },
  (t) => [
    index("imr_site_idx").on(t.siteId),
    index("imr_connection_idx").on(t.connectionId),
    index("imr_site_created_idx").on(t.siteId, t.createdAt),
  ],
);

export type ImportRunRow = typeof importRuns.$inferSelect;
export type NewImportRunRow = typeof importRuns.$inferInsert;

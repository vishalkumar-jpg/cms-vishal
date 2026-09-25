import { index, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { importRuns } from "./import-runs.schema";

export const IMPORT_RUN_ITEM_STATUSES = ["succeeded", "skipped", "failed"] as const;
export type ImportRunItemStatus = (typeof IMPORT_RUN_ITEM_STATUSES)[number];

export const IMPORT_RUN_OB_ENTITY_TYPES = ["page", "post"] as const;
export type ImportRunObEntityType = (typeof IMPORT_RUN_OB_ENTITY_TYPES)[number];

const IMPORT_RUN_ITEM_RUN_ID_LENGTH = 50;
const IMPORT_RUN_ITEM_HS_ID_LENGTH = 64;
const IMPORT_RUN_ITEM_KIND_LENGTH = 20;
const IMPORT_RUN_ITEM_STATUS_LENGTH = 20;
const IMPORT_RUN_ITEM_ENTITY_TYPE_LENGTH = 20;
const IMPORT_RUN_ITEM_ENTITY_ID_LENGTH = 50;
export const IMPORT_RUN_ITEM_ERROR_LENGTH = 2000;

/**
 * Per-item outcomes for a connection-scoped import run (prefix `imi`).
 */
export const importRunItems = obCmsSchema.table(
  "import_run_items",
  {
    ...baseColumns("imi"),
    runId: varchar({ length: IMPORT_RUN_ITEM_RUN_ID_LENGTH })
      .notNull()
      .references(() => importRuns.id, { onDelete: "cascade" }),
    hubspotHsId: varchar({ length: IMPORT_RUN_ITEM_HS_ID_LENGTH }).notNull(),
    hubspotKind: varchar({ length: IMPORT_RUN_ITEM_KIND_LENGTH }).notNull(),
    status: varchar({ length: IMPORT_RUN_ITEM_STATUS_LENGTH })
      .$type<ImportRunItemStatus>()
      .notNull(),
    obEntityType: varchar({ length: IMPORT_RUN_ITEM_ENTITY_TYPE_LENGTH }).$type<
      ImportRunObEntityType | null
    >(),
    obEntityId: varchar({ length: IMPORT_RUN_ITEM_ENTITY_ID_LENGTH }),
    error: varchar({ length: IMPORT_RUN_ITEM_ERROR_LENGTH }),
    finishedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    index("imi_run_idx").on(t.runId),
    index("imi_run_status_idx").on(t.runId, t.status),
  ],
);

export type ImportRunItemRow = typeof importRunItems.$inferSelect;
export type NewImportRunItemRow = typeof importRunItems.$inferInsert;

import { index, jsonb, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";
import { systemUsers } from "./system-users.schema";

/**
 * `auditLog` (prefix `aud`) — append-only accountability trail. Written by
 * `AuditService.record()` from inside each mutating service (ideally same txn).
 *
 * - `siteId` is NULLABLE for platform-level events (e.g. `site.created`,
 *   `platform.admin_granted`).
 * - NO update/delete endpoints by design; baseColumns' updatedAt/deletedAt are
 *   never used here.
 */
export const auditLog = obCmsSchema.table(
  "audit_log",
  {
    ...baseColumns("aud"),
    siteId: varchar({ length: 50 }).references(() => sites.id, { onDelete: "cascade" }),
    actorId: varchar({ length: 50 }).references(() => systemUsers.id, { onDelete: "set null" }),
    action: varchar({ length: 100 }).notNull(), // e.g. site.created, settings.updated
    category: varchar({ length: 30 }), // content|team|settings|domains|sessions|platform
    entityType: varchar({ length: 60 }),
    entityId: varchar({ length: 50 }),
    metadata: jsonb().notNull().default({}),
  },
  (t) => [
    index("aud_site_created_idx").on(t.siteId, t.createdAt),
    index("aud_actor_created_idx").on(t.actorId, t.createdAt),
    index("aud_entity_idx").on(t.entityType, t.entityId),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;

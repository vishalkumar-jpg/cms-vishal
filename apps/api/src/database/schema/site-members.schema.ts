import { index, unique, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";
import { systemUsers } from "./system-users.schema";

/**
 * `siteMembers` (prefix `mbr`) — membership + role PER SITE. This is how
 * "multiple people manage specific websites within a tenant" works.
 *
 * - `siteId` is NULLABLE: a platform-wide `super_admin` is a row with
 *   siteId = NULL. A user may be `editor` on site A and `site_admin` on site B.
 * - role ∈ super_admin | site_admin | editor | contributor (Role enum from
 *   @ob-cms/shared).
 * - unique(siteId, userId): one role per user per site. (NULL siteId rows are
 *   distinct under SQL NULL semantics; the super_admin invariant is enforced in
 *   the service layer.)
 */
export const siteMembers = obCmsSchema.table(
  "site_members",
  {
    ...baseColumns("mbr"),
    siteId: varchar({ length: 50 }).references(() => sites.id, { onDelete: "cascade" }),
    userId: varchar({ length: 50 })
      .notNull()
      .references(() => systemUsers.id, { onDelete: "cascade" }),
    role: varchar({ length: 20 }).notNull(), // super_admin | site_admin | editor | contributor
    status: varchar({ length: 20 }).notNull().default("active"), // active | suspended
    // RBAC-2: optional custom (site-scoped) role. When set, it overrides the
    // built-in `role`'s DEFAULT permission set for the @RequirePermissions gate.
    // `role` is retained and still drives the @Roles() hierarchy unchanged.
    customRoleId: varchar({ length: 50 }),
    invitedBy: varchar({ length: 50 }).references(() => systemUsers.id, { onDelete: "set null" }),
  },
  (t) => [
    unique("mbr_site_user_uq").on(t.siteId, t.userId),
    index("mbr_user_idx").on(t.userId),
    index("mbr_site_idx").on(t.siteId),
    // WAVE4b: a user's "my sites" fan-out, deterministically ordered.
    index("mbr_user_site_idx").on(t.userId, t.siteId),
  ],
);

export type SiteMemberRow = typeof siteMembers.$inferSelect;
export type NewSiteMemberRow = typeof siteMembers.$inferInsert;

import { boolean, index, jsonb, unique, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `customRoles` (prefix `crl`) — RBAC-2: per-site custom roles, ADDITIVE over the
 * 4 built-in roles (super_admin/site_admin/editor/contributor). A custom role is
 * a named subset of the shared PERMISSIONS catalog, scoped to one site.
 *
 * - `siteId` NOT NULL: custom roles are always site-scoped (never platform-wide).
 * - `permissions` jsonb string[] — a subset of @ob-cms/shared PERMISSIONS.
 * - `isBuiltin` is always false here (built-ins live in code, not this table);
 *   the column exists so a future "clone a built-in" flow can flag provenance.
 * - unique(siteId, name): role names are unique within a site.
 *
 * A member is assigned a custom role via `site_members.custom_role_id` (nullable);
 * the built-in `role` column is retained and keeps driving the @Roles hierarchy.
 */
export const customRoles = obCmsSchema.table(
  "custom_roles",
  {
    ...baseColumns("crl"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 100 }).notNull(),
    description: varchar({ length: 500 }),
    permissions: jsonb().notNull().$type<string[]>().default([]),
    isBuiltin: boolean().notNull().default(false),
  },
  (t) => [
    unique("crl_site_name_uq").on(t.siteId, t.name),
    index("crl_site_idx").on(t.siteId),
  ],
);

export type CustomRoleRow = typeof customRoles.$inferSelect;
export type NewCustomRoleRow = typeof customRoles.$inferInsert;

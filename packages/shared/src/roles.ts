import { z } from "zod";

/**
 * RBAC roles — membership is PER-SITE (a user may be `editor` on site A and
 * `site_admin` on site B). `super_admin` is platform-wide. See TECH-ARCHITECTURE §5.
 */
export const ROLES = ["super_admin", "site_admin", "editor", "contributor"] as const;

export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/** Named role tokens for tests and call sites (aligned with {@link ROLES}). */
export const ROLE_SITE_ADMIN: Role = "site_admin";
export const ROLE_CONTRIBUTOR: Role = "contributor";

/** Ordered most→least privileged. Used by the `@Roles()` guard. TODO(W1). */
export const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin: 3,
  site_admin: 2,
  editor: 1,
  contributor: 0,
};

export const hasRoleAtLeast = (have: Role, required: Role): boolean =>
  ROLE_HIERARCHY[have] >= ROLE_HIERARCHY[required];

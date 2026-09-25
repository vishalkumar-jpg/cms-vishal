import { z } from "zod";
import { roleSchema } from "./roles";

/**
 * Core domain types shared by api / admin / renderer.
 * These mirror the Drizzle schema (apps/api/src/database/schema) but are the
 * framework-agnostic contract. Keep them in sync.
 *
 * IDs are prefixed KSUIDs (e.g. `ten_...`, `sit_...`) — see baseColumns.
 */

/** Audit fields present on every row (from baseColumns). */
export const auditFieldsSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
});

/** A tenant — groups one or more sites (an org rolls up multiple sites). */
export const tenantSchema = auditFieldsSchema.extend({
  name: z.string(),
  slug: z.string(),
  plan: z.string().default("free"),
  authMethod: z.enum(["local", "auth0"]).default("local"),
});
export type Tenant = z.infer<typeof tenantSchema>;

/** A site = one website (the tenancy spine: almost every table carries siteId). */
export const siteSchema = auditFieldsSchema.extend({
  tenantId: z.string(),
  name: z.string(),
  subdomain: z.string(),
  customDomain: z.string().nullable().optional(),
  status: z.enum(["active", "suspended"]).default("active"),
});
export type Site = z.infer<typeof siteSchema>;

/** Per-site membership — the join that scopes roles to a website. */
export const siteMemberSchema = auditFieldsSchema.extend({
  siteId: z.string(),
  userId: z.string(),
  role: roleSchema,
});
export type SiteMember = z.infer<typeof siteMemberSchema>;

export const userSchema = auditFieldsSchema.extend({
  email: z.string().email(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  status: z.enum(["active", "invited", "disabled"]).default("active"),
});
export type User = z.infer<typeof userSchema>;

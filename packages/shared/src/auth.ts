import { z } from "zod";
import { roleSchema } from "./roles";

/**
 * Auth & membership contracts shared by api / admin / renderer (W1).
 * These mirror the Drizzle schema in apps/api but are framework-agnostic.
 */

/** The JWT payload signed into the httpOnly session cookie. */
export const jwtPayloadSchema = z.object({
  sub: z.string(), // userId (usr_...)
  email: z.string().email(),
  isPlatformAdmin: z.boolean(),
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

/** A user's membership on a single site (siteId null ⇒ platform super_admin). */
export const membershipSchema = z.object({
  siteId: z.string().nullable(),
  role: roleSchema,
});
export type Membership = z.infer<typeof membershipSchema>;

/** Shape returned by GET /auth/me. */
export const currentUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  isPlatformAdmin: z.boolean(),
  memberships: z.array(membershipSchema),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

/** Site lifecycle visibility. */
export const SITE_VISIBILITY = ["draft", "preview", "public", "archived"] as const;
export const siteVisibilitySchema = z.enum(SITE_VISIBILITY);
export type SiteVisibility = z.infer<typeof siteVisibilitySchema>;

/** Reserved subdomains that may not be claimed by a tenant. */
export const RESERVED_SUBDOMAINS = ["www", "app", "admin", "api", "assets", "static"] as const;

import { SetMetadata } from "@nestjs/common";

/** Metadata key flagging a handler/controller as platform-admin-only. */
export const IS_PLATFORM_ADMIN_KEY = "isPlatformAdmin";

/**
 * Marks a route (or whole controller) as PLATFORM-ADMIN ONLY — cross-tenant,
 * not site-scoped. Enforced by {@link PlatformAdminGuard}: the caller must have
 * `isPlatformAdmin` on their session (the denormalized flag synced with the
 * `super_admin` membership row where `siteId IS NULL`). These routes BYPASS the
 * TenantGuard's per-site membership model and query the raw `db` cross-tenant,
 * so the guard must hard-fail (403) for everyone else.
 */
export const PlatformAdmin = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PLATFORM_ADMIN_KEY, true);

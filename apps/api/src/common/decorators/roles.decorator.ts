import { SetMetadata } from "@nestjs/common";
import type { Role } from "@ob-cms/shared";

/** Metadata key for the minimum role required to call a handler. */
export const ROLES_KEY = "requiredRole";

/**
 * Declarative per-site role requirement. `@Roles('site_admin')` means "the
 * caller must be at least site_admin on the active site". The hierarchy is
 * applied by RolesGuard (super_admin ⊃ site_admin ⊃ editor ⊃ contributor).
 *
 * Pass a single minimum role (hierarchy-checked).
 */
export const Roles = (role: Role): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, role);

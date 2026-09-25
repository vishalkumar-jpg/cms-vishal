import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@ob-cms/shared";

/** Metadata key for the fine-grained permissions a handler requires. */
export const PERMISSIONS_KEY = "requiredPermissions";

/**
 * RBAC-2: OPT-IN fine-grained gate, ADDITIVE over `@Roles()`. Annotate a handler
 * with `@RequirePermissions("page.publish")` and PermissionGuard requires the
 * caller's EFFECTIVE permission set (from their built-in role's default OR their
 * assigned custom role) to include ALL listed permissions.
 *
 * `@Roles()` is untouched and still runs — this is an EXTRA check layered on top
 * for high-value routes, so the existing role hierarchy (and the e2e gates that
 * assert it) keep working exactly as before.
 */
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);

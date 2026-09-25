# RBAC — Custom granular roles (additive over the 4 built-in roles)

RBAC-2 adds **per-site custom roles** with a fine-grained permission set, layered
**on top of** the existing built-in role model. The built-in `@Roles()` hierarchy
is unchanged — every controller and both e2e release gates (tenant-isolation
22/22, platform-admin 7/7) keep working exactly as before.

## 1. Permission catalog (`@ob-cms/shared`)

`packages/shared/src/permissions.ts` exports a pure, framework-free catalog that
both API and admin import:

- `PERMISSION_GROUPS` — domain-grouped, ordered for display.
- `PERMISSIONS` — flat `<domain>.<action>` string list.
- `Permission` type, `permissionSchema`, `isPermission()`.

Domains: `page.*`, `blog.*`, `collection.*`, `media.*`, `form.{view,manage,export}`,
`member.{view,manage}`, `role.{view,manage}`, `domain.{view,manage}`,
`settings.{view,manage}`, `theme.*`, `redirect.*`, `nav.*`, `analytics.view`,
`audit.view`.

## 2. Built-in role → permission mapping

`BUILTIN_ROLE_PERMISSIONS` + `permissionsForBuiltinRole(role)` define the DEFAULT
permission set of each built-in role (this is what preserves today's behaviour):

- `super_admin` → all permissions.
- `site_admin` → all permissions (platform-only concerns are already gated by
  `@Roles("site_admin")` on their controllers, not by this catalog).
- `editor` → content domains **incl. publish/delete** + forms + nav + redirects.
- `contributor` → content view/create/edit **without** publish/delete.

## 3. Custom-role model

- Table `custom_roles` (prefix `crl`): `siteId` (NOT NULL, FK→sites, cascade),
  `name`, `description?`, `permissions jsonb string[]`, `isBuiltin=false`,
  `unique(siteId, name)`. Migration `0022_custom_roles.sql` (duplicate-safe).
- `site_members.custom_role_id` — **new nullable column**. The built-in `role`
  column is retained and still drives the `@Roles()` hierarchy. When a member has
  a live `custom_role_id`, their EFFECTIVE permission set is that role's set;
  otherwise it is the built-in default.

## 4. Guard/decorator approach (why `@Roles` is preserved)

`@Roles()` (hierarchy) is **untouched**. RBAC adds an **opt-in, additive** gate:

- `@RequirePermissions("page.publish", ...)` decorator
  (`common/decorators/permissions.decorator.ts`).
- `PermissionGuard` (`common/guards/permission.guard.ts`), registered globally as
  the LAST `APP_GUARD` (after RolesGuard). It is a **no-op unless the handler is
  annotated** with `@RequirePermissions`, so every existing `@Roles`-only route is
  completely unaffected. Platform admins short-circuit (matching RolesGuard).
- `PermissionService` (`common/tenancy/permission.service.ts`) resolves a member's
  effective permissions: platform-admin → all; live custom role → its set; else
  the built-in role default.

High-value routes carry BOTH gates: the roles controller mutations use
`@Roles("site_admin")` **and** `@RequirePermissions("role.manage")` /
`"member.manage"`. `@Roles` remains the coarse boundary the e2e gates assert;
`@RequirePermissions` is the finer, opt-in layer.

## 5. API surface (`modules/roles`, `sites/:siteId/roles`, `@Roles("site_admin")`)

- `GET  .../roles/permissions` — the catalog.
- `GET  .../roles` — `{ builtin, custom }`.
- `POST .../roles` — create custom role.
- `PUT  .../roles/:roleId` — update.
- `DELETE .../roles/:roleId` — soft-delete (detaches from members first).
- `PATCH .../roles/members/:userId` — assign/clear a member's custom role.

`site-members` `list()` now also returns `customRoleId` + effective `permissions`.

## 6. Admin

- `/roles` — "Roles & Permissions" screen (sidebar under SITE): built-in roles
  (read-only) + custom roles CRUD with a domain-grouped permission checklist.
- Members screen: a per-member "Custom role" selector (built-in default OR a
  custom role) + effective-permission count.

## How the e2e gates stay green

The `@Roles()` decorator, `RolesGuard`, `ROLE_HIERARCHY`, `hasRoleAtLeast`, the
`site_members.role` column and `MembershipService` are all unchanged. The new
guard is opt-in (no-op without `@RequirePermissions`) and the new column is
nullable with a default of "no custom role", so tenant-isolation and
platform-admin behaviour is byte-for-byte identical to before.

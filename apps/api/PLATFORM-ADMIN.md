# Platform-Admin Console

Cross-tenant super-admin area to manage ALL tenants/sites centrally. Every other
admin screen is single-site-scoped (an active site is required via the
`X-Site-Id` header); this area is the one place that reads across every tenant.

## Auth / guard model

Platform-admin is determined by **`system_users.isPlatformAdmin`** — a
denormalized boolean kept in sync with a `super_admin` membership row whose
`siteId IS NULL` (see `database/schema/system-users.schema.ts` and the seed).
The flag rides in the session JWT (`TokenService` → `payload.isPlatformAdmin`),
is set on `req.user` by `JwtAuthGuard`, and mirrored onto the request-scoped
`TenantContext.isPlatformAdmin`.

- **Seeded admin:** email `admin@officebeacon.com` (override via
  `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`), name "Platform Admin",
  `isPlatformAdmin = true`, plus the `siteId = NULL` `super_admin` membership.
  Seeded by `database/seed/seed.ts`.

### New pieces (reuse existing flag — no reinvented concept)

- `common/decorators/platform-admin.decorator.ts` — `@PlatformAdmin()` marks a
  route/controller cross-tenant.
- `common/guards/platform-admin.guard.ts` — `PlatformAdminGuard`, registered as
  a global `APP_GUARD` in `common.module.ts` AFTER `JwtAuthGuard` (so `req.user`
  exists) and before `RolesGuard`. It is a **no-op for non-`@PlatformAdmin()`
  routes**, and for flagged routes **hard-fails with 403** unless
  `req.user.isPlatformAdmin` is true. There is no per-site / hierarchy escape
  hatch.

Why a new guard and not `@Roles('super_admin')`: `@Roles` is enforced relative
to an **active site** (`TenantGuard` + `RolesGuard`), but platform routes carry
no `X-Site-Id` and are not site-scoped. `@PlatformAdmin()` authorizes purely on
the global flag.

Guard chain order (global): `RateLimit → Csrf → JwtAuth → Tenant → PlatformAdmin → Roles`.
For a `/platform/*` request: `TenantGuard` returns early (no siteId, no
`@Roles`), `PlatformAdminGuard` enforces the flag, `RolesGuard` is a no-op
(no `@Roles`).

## Cross-tenant query approach

`PlatformService` (`modules/platform/platform.service.ts`) injects the **raw
`db`** (`DRIZZLE`) directly and **never** uses `ScopedRepository` /
`TenantContext.siteId` (which fail-closed without an active site). All reads
filter only `isNull(deletedAt)` — never `siteId` — so they span every tenant.
Per-site stats are computed with grouped `count()` aggregates (one query per
table, `GROUP BY siteId`) to avoid N+1.

## Endpoints (all `@PlatformAdmin()`, no `X-Site-Id`)

| Method | Path                          | Purpose |
| ------ | ----------------------------- | ------- |
| GET    | `/api/v1/platform/overview`      | Totals: sites, users, pages (+published), forms, submissions, domains — across all tenants. |
| GET    | `/api/v1/platform/sites`         | ALL sites + per-site counts `{ pages, publishedPages, members, forms, domains }`, status/visibility, newest first. |
| POST   | `/api/v1/platform/sites`         | Create a tenant/site. Resolves/creates a default `platform` org, then tx-inserts site + default settings + makes the acting admin `site_admin`. Validates unique slug/subdomain; rejects reserved subdomains. |
| POST   | `/api/v1/platform/sites/:id/suspend` | Set `status = suspended` (public runtime stops serving). Audited (`platform.site.suspended`). |
| POST   | `/api/v1/platform/sites/:id/activate`| Set `status = active`. Audited (`platform.site.activated`). |
| GET    | `/api/v1/platform/users`         | All system users: id, email, name, `isPlatformAdmin`, status, createdAt. |

A non-platform-admin (or unauthenticated) caller gets **403** (401 if no
session) on every route above. Covered by `test/platform-admin.e2e-spec.ts`
(mirrors `tenant-isolation.e2e-spec.ts`).

## Admin console (apps/admin)

- Routes `/platform` (dashboard) and `/platform/sites` live under
  `ProtectedRoute` but in their own `PlatformShell`
  (`components/layout/PlatformShell.tsx`) — a light, clearly branded "Platform
  Admin" chrome with NO `SiteSwitcher`. The shell bounces non-platform-admins to
  `/dashboard`.
- **Dashboard** (`views/platform/PlatformDashboard.tsx`): overview cards +
  recent-sites table from `GET /api/v1/platform/overview` and `/api/v1/platform/sites`.
- **Sites** (`views/platform/PlatformSites.tsx`): table of every tenant with
  stat columns + status badge; **Create site** dialog; **Suspend/Activate**;
  **Open** action that calls `useSiteStore.setActiveSiteId(id)` (the same
  mechanism `SiteSwitcher` uses — sets the `X-Site-Id` resolver + localStorage)
  then navigates to `/dashboard`.
- Data via wrapped React-Query hooks (`views/platform/hooks/usePlatform.ts`)
  keyed by `ADMIN_QUERY_KEYS.PLATFORM_*`. Mutations invalidate the platform
  queries AND `QUERY_KEYS.SITES`, so a console-created tenant immediately shows
  up in the normal `SiteSwitcher`.
- Entry point: a "Platform admin" item in the AppShell user menu, rendered ONLY
  when `user.isPlatformAdmin`.

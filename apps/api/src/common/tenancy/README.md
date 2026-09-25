# Tenancy spine (the isolation boundary)

This directory implements the multi-tenant security boundary from
`team-docs/TECH-ARCHITECTURE.md` §3. Read this before writing any tenant-scoped
query.

## The hard rule

> **Every read or write of a tenant-scoped table (any table carrying `siteId`)
> MUST go through `ScopedRepository`, which ANDs `eq(table.siteId, ctx.siteId)`
> and `isNull(table.deletedAt)` into the predicate.**

Raw `db` access to a tenant table that omits the `siteId` predicate is a
tenant-leak bug. Cross-tenant access must be *structurally impossible*, not a
thing engineers remember to add to the `WHERE` clause.

## How a request is scoped

The global guard chain (registered in `common.module.ts`, in order) runs on
every request unless the route is `@Public`:

1. **`JwtAuthGuard`** — authenticates from the `ob_session` cookie (or
   `Authorization: Bearer`). Populates `req.user` + `TenantContext.user`.
2. **`TenantGuard`** — resolves the active site from the `:siteId` path param or
   `X-Site-Id` header (if both are present and differ → **403**, closing the
   IDOR foot-gun). Validates that the user is an **active member** of that site
   (or is a platform admin → membership bypassed but scoping still applied).
   Sets `TenantContext.siteId` + `role`.
3. **`RolesGuard`** — enforces the `@Roles(min)` hierarchy
   (`super_admin ⊃ site_admin ⊃ editor ⊃ contributor`) on the active site.

`TenantContext` and `ScopedRepository` are **request-scoped** — there is no
ambient cross-request state.

## Usage

```ts
// Reads/writes of a tenant table:
const rows = await this.repo.db
  .select()
  .from(auditLog)
  .where(this.repo.scope(auditLog, eq(auditLog.action, "site.created")));

// Inserts get the active site stamped automatically:
await this.repo.db.insert(pages).values({ ...this.repo.insertDefaults(), title });
```

`scope()` throws (fail-closed) if there is no active `siteId`.

## Foot-guns (do NOT)

- **Never** add a "skip scoping" flag to `ScopedRepository`. Platform-wide
  listings use the explicit `/platform/*` or `/organizations` endpoints with the
  raw `db` (super_admin only).
- **Background jobs run outside a request** — there is no `TenantContext`. Every
  BullMQ job payload must carry `siteId` explicitly and build its own scoped
  predicate; never trust ambient context in a worker.
- **Cache keys** for tenant data must be namespaced by `siteId`
  (`site:<id>:…`).
- **Joins** must carry `siteId` on the driving table so a join to a non-scoped
  table (e.g. `system_users`) can't return another site's rows.

## Release gate

`test/tenant-isolation.e2e-spec.ts` seeds two sites and asserts cross-tenant
`GET/PATCH` all fail (403/404) and the scoped audit listing never returns the
other site's rows. This suite must stay green.

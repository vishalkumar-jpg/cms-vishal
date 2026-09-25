# Custom Domains — binding, DNS verification & TLS

Lets a tenant bind their own domain (e.g. `www.acme.com`) to a site, prove
ownership + routing via DNS, and have the public renderer serve the site on it.

## Schema (`site_domains`, prefix `dom`)

Defined in `src/database/schema/site-domains.schema.ts`. Globally `unique(domain)`
(anti-takeover — one domain belongs to one site). Tenant-scoped via `siteId`, so
all reads/writes go through the `ScopedRepository`.

| column | notes |
| --- | --- |
| `siteId` | FK → `sites.id`, cascade delete |
| `domain` | lowercased bare hostname, globally unique |
| `status` | `pending` → `verifying` → `verified` → `active`, or `failed` |
| `verified` | boolean fast-flag used by the host resolver |
| `verificationToken` | random (base64url) value published in the TXT record |
| `verificationMethod` | `dns-txt` (only method today) |
| `tlsStatus` | `none` \| `pending` \| `issued` \| `failed` |
| `isPrimary` | single primary per site |
| `verifiedAt`, `lastCheckedAt` | timestamps |

Migration `0008_site_domains.sql` adds `verification_method` + `tls_status`
(idempotent `ADD COLUMN IF NOT EXISTS`; base table ships in `0000`).

## Endpoints (`/api/v1/domains`, X-Site-Id scoped)

Reads require `contributor`; all mutations require `site_admin`. Audited
(`category: settings`, `entityType: domain`).

- `GET /api/v1/domains` — list the site's domains.
- `POST /api/v1/domains` `{ domain }` — generates a `verificationToken`, inserts a
  `pending` row, returns `{ domain, instructions }` (the exact DNS records).
- `POST /api/v1/domains/:id/verify` — runs a real DNS TXT lookup; on success marks
  `verified` + kicks TLS; on failure marks `failed` with a `reason` (never a 500).
- `POST /api/v1/domains/:id/primary` — requires a verified domain; sets `isPrimary`
  (single per site) and mirrors onto `sites.custom_domain` / `sites.primary_domain`.
- `DELETE /api/v1/domains/:id` — soft-deletes; detaches from the site if it was the
  active custom/primary domain.

## DNS verification mechanism

Uses `node:dns/promises` `resolveTxt`. The tenant must publish **two** records:

1. **Ownership (TXT)** — name `_ob-verify.<domain>`, value `ob-verify=<token>`.
2. **Routing (CNAME)** — `<domain>` → the platform host (`PLATFORM_DOMAIN` env,
   default `app.ob-cms.local`).

`verify` resolves `_ob-verify.<domain>` and checks for `ob-verify=<token>` among
the returned TXT records. `ENOTFOUND` / `ENODATA` / any lookup error → `failed`
with a human-readable reason; the row's `lastCheckedAt` is always stamped.

## TLS seam

`TlsService` (`src/modules/domains/tls.service.ts`) is the provisioning interface.
The bound impl is `MockTlsService`, which immediately returns `issued` **without**
creating a real certificate (logs a loud warning). Verifying a domain flips
`tlsStatus` to `issued` and `status` to `active`.

**Production** wires a real provider behind the same `TLS_SERVICE` token: request
an **AWS ACM** certificate (DNS-validated) or drive an **ACME / Let's Encrypt**
http-01/dns-01 order (e.g. `acme-client`, or Caddy on-demand TLS). Cert storage +
renewal live behind this seam.

## Host resolution

`src/modules/seo/site-resolver.service.ts` already resolves a Host header to a
site via (1) `sites.custom_domain` / `primary_domain`, (2) a `verified`
`site_domains.domain`, then (3) subdomain. Verify + set-primary call
`SiteResolver.invalidate()` to drop the stale Redis host→site cache entry.

## Admin UI

`apps/admin/src/views/domains/` — a **Domains** screen (sidebar SITE entry, route
`/domains`): lists domains with status + TLS badges and a primary marker; an
**Add domain** dialog that shows the copyable TXT + CNAME records on success; a
**Verify** button (toasts success / the failure reason); **Set as primary** and
**Delete** actions; and an expandable per-row DNS-records panel. All server access
goes through wrapped React Query hooks keyed on `ADMIN_QUERY_KEYS.DOMAINS`.

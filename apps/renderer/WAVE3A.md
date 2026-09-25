# WAVE 3a — Public Site Renderer (`apps/renderer`)

Next.js App Router renderer that serves published OB-CMS pages on the public web.
It resolves the tenant by Host, fetches published render data from the internal
API (`/api/v1/public/*`, Wave 3b), migrates the layout to the current schema, and
renders the **shared** `@ob-cms/blocks` registry — the same components the
builder uses (editor↔renderer parity, TECH-ARCHITECTURE §2.4).

## Routes & handlers

| Path | File | Purpose |
| --- | --- | --- |
| `/[[...slug]]` | `src/app/[[...slug]]/page.tsx` | Catch-all SSR/ISR page. Host→site, fetch page, `migrate()`, render `<RenderLayout data blocks={blockRegistry}/>` inside a theme-var wrapper + header/footer. `generateMetadata` emits SEO (title/description/canonical/OG/Twitter/noindex). |
| `/api/revalidate` | `src/app/api/revalidate/route.ts` | Secret-protected on-demand revalidation + Redis purge (publish/cache-purge hook). |
| `/sitemap.xml` | `src/app/sitemap.xml/route.ts` | Proxies the API's host-resolved sitemap to the site root. |
| `/robots.txt` | `src/app/robots.txt/route.ts` | Proxies the API's host-resolved robots.txt. |
| `not-found` | `src/app/not-found.tsx` | 404 (unknown host or unpublished path). |
| `error` | `src/app/error.tsx` | Client error boundary for SSR failures. |
| middleware | `src/middleware.ts` | Tenant redirects (301/302) + security headers (CSP/HSTS/X-Frame-Options). |

### Lib
- `lib/host.ts` — resolve public Host (`x-forwarded-host` → `host`), normalized.
- `lib/api-client.ts` — `publicGet<T>()`; forwards Host, unwraps `{ data }`, 404→`null`, uses Next fetch data cache (`revalidate`/`tags`).
- `lib/site-data.ts` — `getSite(host)`, `getNavigation(host, siteId)` (React `cache()` + Redis + ISR).
- `lib/page-data.ts` — `getPage(host, siteId, path)` (Redis `render:` cache, migrate on read), `slugToPath()`.
- `lib/redis.ts` — best-effort ioredis singleton (`get/set/del`, glob purge); failures = cache miss, never fatal.
- `lib/cache-keys.ts` — Redis keys + Next cache tags (single source of truth).
- `lib/theme.ts` — theme tokens → CSS custom properties.
- `lib/public-api-types.ts` — documented `/api/v1/public/*` shapes.
- `lib/env.ts` — env accessors.
- `components/site-navigation.tsx` — header/footer chrome.

## Tenant resolution + caching strategy

1. **Host** comes from `x-forwarded-host` (CDN) falling back to `host`, lowercased.
2. **`getSite(host)`** → `GET /api/v1/public/site` (Host forwarded). Tiers:
   - React `cache()` — dedupe within one SSR pass.
   - Redis `site:<host>` (TTL 5m) — cross-instance/request reuse.
   - Next fetch data cache (ISR, tag `site:<host>`) — origin fallback.
   - Unknown host → API 404 → `null` → route calls `notFound()`.
3. **`getPage(host, siteId, path)`** → `GET /api/v1/public/page?path=` with Redis
   `render:<siteId>:<path>` (TTL 2m, tag `page:<siteId>:<path>`). The cached blob
   is the **raw** API page (pre-migrate); `migrate()` runs on every read so a
   schema bump can't serve a stale-shaped layout.
4. **`getNavigation`** → `GET /api/v1/public/navigation`, Redis `nav:<siteId>`.
5. **ISR**: `export const revalidate = 60` on the page (env-overridable default
   via `RENDERER_ISR_REVALIDATE`, applied at the fetch layer).
6. **Theme**: `site.theme.tokens` → `--token` CSS vars on the page wrapper, so
   shared blocks reading `var(--token)` are themed per tenant.
7. **Personalization seam (Wave 4)**: commented hook in `page.tsx` right before
   `RenderLayout` to resolve a visitor variant and post-process the node map.
   **Not implemented** in 3a.

## Revalidation / cache-purge contract (API → renderer)

`POST /api/revalidate`
- Auth: header `x-revalidate-secret: <REVALIDATE_SECRET>` (or `?secret=`). Fails
  **closed** if `REVALIDATE_SECRET` is unset.
- Body:
  ```json
  {
    "siteId": "sit_123",        // required
    "host": "officebeacon.com", // optional; used for site/redirect cache keys
    "paths": ["/", "/pricing"], // canonical paths to purge
    "purgeSite": false,         // also drop site-resolution + nav caches
    "purgeAll": false           // drop ALL render:<siteId>:* + revalidate layout
  }
  ```
- Actions: clears Redis (`render:<siteId>:<path>` or `render:<siteId>:*`; with
  `purgeSite` also `site:<host>`, `nav:<siteId>`) **and** Next ISR
  (`revalidateTag(page:/site:/nav:)` + `revalidatePath`). Best-effort, idempotent.
- Response: `{ revalidated: true, siteId, paths, purgedSite, purgedAll }`.

**When the API should call it:** on publish of a page (`paths:[<path>]`), on
site/theme/nav change (`purgeSite:true`), on bulk republish (`purgeAll:true`).

## Redirects (middleware)
On each request, `GET /api/v1/public/redirect?path=` (Host forwarded, Next data
cache TTL `RENDERER_REDIRECT_TTL`, default 30s). A match issues 301 (or 302 if
`statusCode===302`) to `toPath` (absolute or site-relative). Edge runtime → no
ioredis there; the fetch data cache keeps it fast. Failures fall through.

## Env vars
| Var | Default | Use |
| --- | --- | --- |
| `INTERNAL_API_URL` | `http://localhost:3001` | Internal API origin. |
| `REVALIDATE_SECRET` | _(unset → revalidate disabled)_ | Shared secret for `/api/revalidate`. |
| `RENDERER_ISR_REVALIDATE` | `60` | ISR seconds for page/site fetches. |
| `RENDERER_REDIRECT_TTL` | `30` | Redirect lookup cache seconds (middleware). |
| `RENDERER_REDIS_CACHE` | `true` | Set `false` to disable the Redis tier. |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost` / `6379` / — | ioredis (mirrors the API's convention). |

## Security & performance
- CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy set in `middleware.ts` (per-request) + `next.config.mjs`
  (`headers()`, defense-in-depth for static/route-handler responses).
- SSR/ISR cache-first; Redis fronts the origin so publish bursts don't bottleneck.
- `images.remotePatterns` allows remote block images (tighten to asset hosts in prod).

## Verify
1. `bun run type-check` (monorepo) and `cd apps/renderer && bun run build`.
2. With the API running + a published OB page:
   ```bash
   curl -H "Host: officebeacon.localhost" http://localhost:3000/
   ```
   → rendered HTML containing shared block markup, `<title>`/meta from page SEO,
   and `style="--…"` theme vars on the wrapper `div[data-ob-site]`.
3. `curl -H "Host: officebeacon.localhost" http://localhost:3000/sitemap.xml`
   and `/robots.txt` return the API-proxied content.
4. Configure a redirect in the API, then
   `curl -i -H "Host: officebeacon.localhost" http://localhost:3000/<from>` → `301`.
5. Purge: `curl -X POST -H "x-revalidate-secret: $REVALIDATE_SECRET" \
   -H 'content-type: application/json' \
   -d '{"siteId":"sit_123","paths":["/"]}' http://localhost:3000/api/revalidate`.

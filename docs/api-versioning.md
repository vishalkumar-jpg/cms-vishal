# API Versioning Standard

All HTTP APIs exposed by the OB CMS NestJS application **must** be versioned.

## Current version

- **Version segment:** `v1`
- **Global prefix:** `/api/v1` (configured in `apps/api/src/config/app.config.ts` as `globalPrefix`, sourced from `API_GLOBAL_PREFIX` in `@ob-cms/shared`)

## Route shape

| Surface | Example |
|---------|---------|
| Authenticated admin API | `/api/v1/pages`, `/api/v1/forms`, `/api/v1/collections` |
| Public (host-resolved) API | `/api/v1/public/site`, `/api/v1/public/collections/:slug/items` |
| Platform admin | `/api/v1/platform/overview` |
| Content API (Bearer key) | `/api/v1/content/...` |
| Health | `/api/v1/health` |

## Shared constants

Defined in `packages/shared/src/constants.ts`:

- `API_VERSION` — `"v1"`
- `API_GLOBAL_PREFIX` — `api/v1` (NestJS `setGlobalPrefix`, no leading slash)
- `API_PREFIX` — `/api/v1` (URI prefix for clients)
- `PUBLIC_API_PREFIX` — `/api/v1/public`

Consumers (admin Axios base URL, renderer upstream fetches) must use these constants or helpers built from them — never hardcode unversioned `/api/...` paths.

## Intentional exclusions

These are **not** versioned Nest routes:

| Path | Reason |
|------|--------|
| `/sitemap.xml`, `/robots.txt` | SEO convention — excluded from global prefix via `GLOBAL_PREFIX_EXCLUSIONS` in `app.config.ts` |
| `/docs`, `/docs-json` | Swagger UI / OpenAPI spec (mounted outside the versioned prefix) |
| Renderer same-origin proxies | Next.js routes at `/api/forms/:id`, `/api/search`, etc. — these proxy **to** `/api/v1/...` on the internal API |

## Future versions

When introducing `/api/v2`:

1. **Do not remove `/api/v1` immediately.** Either serve both versions concurrently (preferred) or run an explicit, documented deprecation period before retiring v1.
2. Add v2 via Nest multi-version support or a separate global prefix — never overwrite v1 routes in-place in a single release.
3. Migrate all consumers before removing v1; no mixed unversioned routes at any time.
4. Update this document and `.cursor/rules/engineering-standards.mdc`.

Backward compatibility for existing v1 clients is mandatory until v1 is formally sunset.

## Rules for new work

- **Never** add endpoints under `/api/<resource>` without the `v1` segment.
- When touching existing routes, verify version consistency across controllers, SDK, renderer proxies, tests, and docs.
- Mention API versioning in PR descriptions when routes change.

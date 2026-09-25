# WAVE 2b — CMS content API (pages, blog, media, navigation, themes, redirects, SEO, templates)

Implements the CMS authoring core on top of the Wave 1 tenancy/auth/RBAC spine.
Every tenant table carries `siteId` and is read/written through the
`ScopedRepository`; every mutation is role-guarded, DTO-validated, input-sanitized
and audited. Public SEO routes are host-resolved (no auth).

## Tables added (migration `0001_wave2_cms.sql`)

| table | prefix | notes |
|-------|--------|-------|
| `pages` | `pag` | draft/publish: `draftLayout`+`publishedLayout` jsonb, `seo` jsonb, `parentId` self-FK, `schemaVersion`, `scheduledAt`/`publishedAt`. UNIQUE(siteId,slug). |
| `page_versions` | `pvr` | immutable publish/rollback snapshots ({layout,seo}). |
| `posts` | `pst` | blog posts (layout/richtext, excerpt, coverMediaId, authorId). UNIQUE(siteId,slug). |
| `post_terms` | `ptm` | categories/tags. UNIQUE(postId,kind,slug). |
| `media` | `med` | storageKey, url, type, alt, `tags text[]`, size/width/height, `variants`, status, uploadedBy. |
| `navigation` | `nav` | one tree per location. UNIQUE(siteId,location). |
| `themes` | `thm` | design tokens (CSS vars) + brand. UNIQUE(siteId). |
| `redirects` | `rdr` | fromPath→toPath + statusCode (default 301). UNIQUE(siteId,fromPath). |
| `page_templates` | `tpl` | page/section presets. `siteId` NULLABLE → NULL = global preset. |

Schema files under `src/database/schema/*.schema.ts`, exported from `schema/index.ts`.

## Modules added (`src/modules/*`) + endpoints (method path — min role)

All admin routes require `X-Site-Id` (or `:siteId`); the role is the minimum on
that site (hierarchy: super_admin ⊃ site_admin ⊃ editor ⊃ contributor).

### pages
- `GET /pages` (contributor) · `POST /pages` (contributor) · `GET /pages/:id` (contributor)
- `PATCH /pages/:id` (contributor) · `PATCH /pages/:id/draft` (contributor, autosave; `If-Match: <updatedAt ISO>` → 409 on stale)
- `POST /pages/:id/publish` (editor) — copies draft→published, snapshots a version, sets publishedAt, enqueues `cache-purge` + debounced `sitemap-rebuild`
- `POST /pages/:id/schedule` (editor) · `GET /pages/:id/versions` (contributor) · `POST /pages/:id/rollback/:versionId` (editor)
- `POST /pages/import-poc` (editor) — runs `importPocExport`, creates a draft page · `DELETE /pages/:id` (editor)

### blog
- `GET /posts` (contributor, `?status&category&q`) · `POST /posts` (contributor) · `GET /posts/:id` (contributor)
- `PATCH /posts/:id` (contributor) · `POST /posts/:id/publish` (editor) · `POST /posts/:id/schedule` (editor) · `DELETE /posts/:id` (editor)

### media
- `POST /media/presign` (contributor) — reserves a row + presigned S3/MinIO PUT URL
- `POST /media/confirm` (contributor) — marks ready, enqueues `media-process`
- `GET /media` (contributor, `?type&q&tag`) · `GET /media/export.csv` (editor, formula-injection-safe)
- `GET /media/:id` (contributor) · `PATCH /media/:id` (contributor, alt/tags) · `DELETE /media/:id` (editor)

### navigation
- `GET /navigation` (contributor) · `GET /navigation/:location` (contributor) · `PUT /navigation/:location` (editor, upsert)

### themes
- `GET /theme` (contributor, auto-creates) · `PATCH /theme` (site_admin)

### redirects
- `GET /redirects` (contributor) · `POST /redirects` (editor, loop-checked) · `POST /redirects/import` (editor, bulk CSV, loop-safe)
- `PATCH /redirects/:id` (editor) · `DELETE /redirects/:id` (editor)

### templates
- `GET /templates` (contributor, own + global presets) · `GET /templates/:id` (contributor)
- `POST /templates` (editor) · `DELETE /templates/:id` (editor, own only)

### seo (PUBLIC, host-resolved, no auth — registered OUTSIDE the `/api` prefix)
- `GET /sitemap.xml` — published, non-noindex pages+posts with lastmod; cached in Redis
- `GET /robots.txt` — generated per site, references the sitemap
- Host→site via `SiteResolver` (custom/primary domain → verified `site_domains` → subdomain), Redis-cached.

## BullMQ queues introduced (`src/modules/queue/queue.constants.ts`)
- `media-process` (job `process`, payload `{siteId,mediaId,storageKey}`) — image dimensions/variants (worker stub).
- `sitemap-rebuild` (job `rebuild`, payload `{siteId}`) — debounced via `jobId: sitemap:<siteId>` + 5s delay; worker regenerates and calls `SeoService.purgeSitemap`.
- `cache-purge` (job `purge`, payload `{siteId,entity,entityId,slug}`) — renderer cache invalidation on publish.

Producers live in `QueueService`; processors are completed in the worker wave.

## New dependencies (added to `apps/api/package.json`, run `bun install`)
- `@ob-cms/block-schema` (workspace) — layout validation/import.
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — presigned uploads (S3/MinIO).

## Env (all have safe local defaults)
```
S3_ENDPOINT=http://localhost:9000     # MinIO; omit for real AWS S3
S3_REGION=us-east-1
S3_BUCKET=ob-cms-media
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_PUBLIC_URL=                         # public base for asset URLs (optional)
```

## Acceptance-by-construction
1. Strict TS; mirrors Wave 1 patterns (ScopedRepository, responseUtils, DTOs, audit).
2. `0001_wave2_cms.sql` + `_journal.json` entry follow the 0000 format → `bun run db:migrate` applies it.
3. Pages create→autosave→publish snapshots a `page_versions` row; rollback restores a snapshot into the draft.
4. `/sitemap.xml` + `/robots.txt` host-resolved + Redis-cached; purged via `sitemap-rebuild`.
5. All admin endpoints tenant-scoped; e2e isolation spec extended with page + media cross-site cases.

## Verify

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"
cd /Users/yash/www/ob-cms/platform && bun install      # pulls block-schema + aws-sdk

# 1. type-check
bun run type-check

# 2. apply migration (Postgres on 5433)
cd apps/api && bun run db:migrate

# 3. boot + smoke (login as the seeded super_admin)
bun run dev
curl -i -c /tmp/ob.cookie -X POST http://localhost:3001/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@officebeacon.com","password":"ChangeMe123!"}'
SITE=$(curl -s -b /tmp/ob.cookie http://localhost:3001/api/sites | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"][0]["id"])')

# create a page
PAGE=$(curl -s -b /tmp/ob.cookie -X POST http://localhost:3001/api/pages \
  -H 'content-type: application/json' -H "x-site-id: $SITE" \
  -d '{"title":"Home","slug":"home"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')

# autosave a draft layout
curl -s -b /tmp/ob.cookie -X PATCH http://localhost:3001/api/pages/$PAGE/draft \
  -H 'content-type: application/json' -H "x-site-id: $SITE" \
  -d '{"layout":{"schemaVersion":"2.0","root":"ROOT","nodes":{"ROOT":{"type":{"resolvedName":"Section"},"isCanvas":true,"props":{},"nodes":[]}}}}'

# publish → publishedLayout set + a version row
curl -s -b /tmp/ob.cookie -X POST http://localhost:3001/api/pages/$PAGE/publish \
  -H "x-site-id: $SITE"
curl -s -b /tmp/ob.cookie http://localhost:3001/api/pages/$PAGE/versions -H "x-site-id: $SITE"

# sitemap + robots (host-resolved; use the OfficeBeacon subdomain host)
curl -s http://localhost:3001/sitemap.xml -H 'Host: officebeacon.localhost'
curl -s http://localhost:3001/robots.txt  -H 'Host: officebeacon.localhost'

# 4. isolation gate (now includes page + media cross-site cases)
bun run test:e2e
```

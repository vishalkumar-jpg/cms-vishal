# HubSpot Import (backlog #28)

Onboarding migration tool: import a tenant's existing **HubSpot CMS pages** and
**blog posts** into OB-CMS. Built for OfficeBeacon, whose live site is HubSpot-built.

Module: `apps/api/src/modules/hubspot-import` (registered in `app.module.ts`).

**Primary Admin path:** **Connectors** (`/connectors`) — stored connection
credentials, scoped preview/import, and import activity (`import_runs`). See
`apps/api/src/modules/connectors`.

**Legacy Admin path:** token-in-request UI at `/import` (redirects to `/connectors`;
legacy module still callable via API below).

All endpoints are site-scoped (X-Site-Id header / TenantGuard), guarded by
`@Roles("site_admin")`, return via `responseUtils`, and audit the import
(`hubspot.imported`, category `content`).

## Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/v1/hubspot-import/preview` | `{ token }` | `{ pages: PreviewItem[], posts: PreviewItem[] }` |
| POST | `/api/v1/hubspot-import/run` | `{ token, pageIds[], postIds[] }` | `ImportSummary` |
| POST | `/api/v1/hubspot-import/run-export` | `{ items: ExportItem[] }` | `ImportSummary` |

```
PreviewItem  = { hsId, name, slug, updatedAt }
ImportSummary = { importedPages, importedPosts, skipped: { name, reason }[] }
```

## HubSpot API calls (server-side)

Called with the provided private-app token as `Authorization: Bearer <token>`:

- `GET https://api.hubapi.com/cms/v3/pages` — list pages (preview)
- `GET https://api.hubapi.com/cms/v3/blogs/posts` — list posts (preview)
- `GET /cms/v3/pages/{id}` — full page (run)
- `GET /cms/v3/blogs/posts/{id}` — full post (run)

**Scopes needed on the private app:** `cms.pages.read` (CMS pages) and
`content` (blog posts / blog content).

**Graceful failure:** auth failures (401/403), other non-2xx, network errors and
unreadable bodies are converted to a clean `BadRequestException` (HTTP 400 with a
human message) — never a 500. In `run`, a single item's failure is recorded in
`skipped[]` and the rest continue.

## Source extraction (Universal Page Model)

Connection-scoped import (`ConnectorsImportService` → `HubspotImportService.runScoped`)
builds a **HubSpot Universal Page Model (UPM)** from each fetched CMS object via
`extractHubspotUniversalPage` in `@ob-cms/block-schema`, then derives legacy
import HTML with `deriveLegacyImportHtml` (same precedence as
`normalizeHubspotContent`). That HTML is what gets wrapped in Embed — **not** a
native HubSpot→OB block conversion yet.

```
HubSpot API response
  → extractHubspotUniversalPage (UPM; preserves layout/modules/raw fields)
  → deriveLegacyImportHtml
  → existing Embed SerializedLayout → PagesService / BlogService
```

Future migration PRs will consume the UPM for layout, native components, design
tokens, responsive behavior, and assets. **#109B does not implement those stages.**

**Legacy token `run` (live HubSpot fetch by id):** uses in-service `normalize()` only
(no UPM). Body HTML is `postBody ?? html ?? body ?? widgetHtml`, where `widgetHtml`
is HTML joined from `widgetContainers` — **not** from `layoutSections`. Does not
call `extractHubspotUniversalPage` or `hubspotImportNormalizedFromSource`.

**Legacy `run-export` (offline JSON array):** reads each item’s `html` field as-is
and passes it into the Embed layout. Does not run UPM extraction or in-service
`normalize()` on HubSpot API shapes.

## Mapping to OB-CMS (Embed-block layouts)

Each imported item's body HTML is wrapped in an **Embed** block inside a
`SerializedLayout` whose root is a `Section`:

```
root Section ──▶ Embed { props.html = <imported HTML> }
```

The shared `@ob-cms/blocks` **Embed** block (`resolvedName: "Embed"`, prop
`html`) sanitizes the HTML at render time (`sanitizeEmbedHtml`: allow-listed
formatting tags + sandboxed iframes; `<script>`/handlers/`javascript:` stripped),
so raw HubSpot markup is safe.

- **page** → `PagesService.create` with: `title = name`,
  `slug` (HubSpot slug or slugified name), `seo` from `htmlTitle`/`metaDescription`,
  `draftLayout` = the Embed layout.
- **post** → `BlogService.create` with the same shape (`layout` = Embed layout).

**Publish state (connection-scoped import only):** after create, items whose
HubSpot detail state is published (`PUBLISHED*`) are finalized via
`PagesService.publish` / `BlogService.publish`. Draft/scheduled/non-published
HubSpot items remain OB **draft**. Scope `published` imports only published
inventory; scope `all` imports both but only publishes HubSpot-published rows.

**Legacy** `hubspot-import` `run` / `run-export` paths always create **draft**
content (no publish step).

**Scoped import:** body HTML comes from UPM legacy derivation (`deriveLegacyImportHtml`,
same precedence as `normalizeHubspotContent`: `postBody` → `html` → `body` →
`layoutSections` → `widgetContainers`).

**Legacy `run`:** see above — widget-container HTML only, no `layoutSections`.

**Legacy `run-export`:** uses uploaded `html` per item; no HubSpot normalization.

**Slug collisions** are resolved by suffixing (`about → about-1 → about-2 …`)
rather than failing — creation reuses the normal pages/blog create path, so
validation, slug rules and audit are identical to manually-created content.

## Offline export shape (testable without a live token)

`POST /api/v1/hubspot-import/run-export` accepts an uploaded/pasted JSON **array**:

```json
[
  {
    "name": "About Us",
    "slug": "about-imported",
    "html": "<h1>About</h1><p>Imported.</p>",
    "metaDescription": "x"
  }
]
```

Per item: `name` (required), `slug` (optional — derived from name if absent),
`html` (required), `metaDescription` (optional), and `type` (`"page"` default, or
`"post"` to import as a blog post). Same mapping as the live path.

## Token handling

**Connectors:** credentials are encrypted in `connector_connections` and resolved
per connection for `/api/v1/connectors/connections/:connectionId/import`.

**Legacy hubspot-import:** the private-app token is **accepted per request and
never persisted**. The offline export path needs no token at all.

## Environment (portal allowlist)

API enforces an allowlist before HubSpot connect/import (see
`packages/block-schema` `hubspot-portal-allowlist.ts`):

| Variable | Purpose |
| --- | --- |
| `HUBSPOT_ALLOWED_PORTAL_IDS` | Comma-separated HubSpot portal ids (preferred) |
| `HUBSPOT_ALLOWED_PORTAL_ID` | Single portal id (backward compatible) |

When unset, local dev defaults to the OB sandbox portal id. **UAT/production**
should set `HUBSPOT_ALLOWED_PORTAL_IDS` explicitly (DevOps).

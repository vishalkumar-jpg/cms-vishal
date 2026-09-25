# On-Site Full-Text Search (#64)

Public, site-scoped Postgres full-text search on the **published** website across
**pages**, **blog posts** and **collection items** — a Search block (styled input +
results) that queries a host-resolved public endpoint. The admin ⌘K ILIKE search
(`SearchService` / `GET /search`, `@Roles("contributor")`) is **untouched**.

## 1. Full-text index + query (API)

**Migration:** `apps/api/src/database/migrations/0029_onsite_search.sql`
(journal entry idx 29). It adds **three EXPRESSION-based GIN indexes** — *not*
generated/stored `tsvector` columns, and no Drizzle schema change (so no snapshot
regen). Expression indexes were chosen because the searchable text spans plain
columns **and** jsonb (`seo`, `data`, `published_layout`/`layout`), and a stable
GENERATED tsvector over jsonb would need IMMUTABLE extraction wrappers.

Indexes are **partial** (`WHERE status='published' AND deleted_at IS NULL`) to stay
small/hot, over `to_tsvector('english', <doc>)`:

| table              | indexed document (`<doc>`)                                        |
|--------------------|-------------------------------------------------------------------|
| `pages`            | `title + slug + seo::text + published_layout::text`               |
| `posts`            | `title + slug + excerpt + seo::text + layout::text`               |
| `collection_items` | `slug + data::text`                                               |

**Scope note:** page/post body text is indexed by casting the block-layout JSON to
`::text` (so field values are findable) rather than a semantic block-tree
extraction — this is intentionally lightweight and covers `seo.title/description`
plus all inline text. Collection items index `slug + data::text`.

**Query** (`SiteSearchService`, `apps/api/src/modules/search/site-search.service.ts`):
builds the SAME `to_tsvector('english', <doc>)` expression, matches it with
`@@ websearch_to_tsquery('english', q)` (Google-style syntax), orders by
`ts_rank(...) DESC`, and produces `ts_headline(...)` snippets with
`StartSel=<mark>,StopSel=</mark>`. Per-type result sets are merged and re-sorted by
rank, capped at `limit` (default 10, max 50). Pages/posts are searched in the
site's DEFAULT locale (mirrors the public blog/page index).

## 2. Public endpoint contract (API)

`GET /api/v1/public/search?q=&type=&limit=` — `@Public`, host-resolved via
`SiteResolver` (SERVER-SIDE from the Host header; no client siteId is trusted),
rate-limited per IP (`form` bucket, name `site-search`). Only that site's
**published, non-deleted** content is returned — no cross-tenant, no drafts.

- `q` (required) — search terms (websearch syntax). Empty → `[]`.
- `type` (optional) — CSV of `page|post|collection` (default: all).
- `limit` (optional) — 1..50, default 10.

Response (responseUtils envelope `{ data }`):
```
Array<{ type: "page"|"post"|"collection", title, url, snippet, rank }>
```
`url` is site-relative (`/`, `/<slug>`, `/blog/<slug>`, `/<collection>/<item>`);
`snippet` is a `ts_headline` fragment (only `<mark>` markup, all else HTML-escaped).

Wired in `SearchModule` (imports `SeoModule` for `SiteResolver`);
`PublicSearchController` + `SiteSearchService` added alongside the admin search.

## 3. Search block + proxy (parity)

**Block:** `packages/blocks/src/blocks/search.tsx` — a `"use client"` island,
registered as `Search` in `registry.tsx` + `block-schema` `blockPropSchemas`
(schema `searchSchema`: `placeholder`, `buttonLabel`, `showButton`, `styles`).
Added to the admin palette (`Forms` category) and the block-count test (37).

- **Editor / SSR (parity):** renders a STATIC box (input + optional button),
  byte-identical everywhere. It never queries before mount (`useMounted`) — no
  `window` at module load, no hydration mismatch.
- **Renderer (published):** on submit it `fetch`es the same-origin
  `/api/search?q=…` proxy (browser-facing Next.js route) and renders a ranked results list (title link + snippet)
  with loading / empty / no-results / error states. Snippets are split on
  `<mark>…</mark>` and rendered as text-with-marks (never raw HTML) — no XSS surface.

**Proxy:** `apps/renderer/src/app/api/search/route.ts` — same-origin GET that
forwards the tenant `Host`/`x-forwarded-host` to
`${INTERNAL_API_URL}/api/v1/public/search` (mirrors the forms-definition proxy),
`revalidate: 30`.

## 4. SSR-safety + parity

The box renders identically in the builder and the renderer (shared block, static
server output); results are strictly client-fetched after mount. The renderer's
RSC boundary is intact — `render-layout.tsx` stays a hook-free pure walker; the
Search island crosses the boundary with plain-JSON props like any other
`"use client"` block (e.g. Form).

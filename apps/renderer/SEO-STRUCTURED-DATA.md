# SEO: Structured Data, Social Previews & Auto-301 (gap D22)

Adds JSON-LD structured data + an admin social-preview/score panel + automatic
301 redirects on published-page slug changes. Per-page meta/OG and sitemap/robots
already existed; this layers schema.org data, previews, scoring, and slug-change
redirects on top.

## 1. JSON-LD structured data (renderer)

Builders live in `apps/renderer/src/lib/structured-data.ts` (pure, SSR-safe — no
`window`/`document`; they take already-fetched site/page/post data). The
`apps/renderer/src/components/json-ld.tsx` server component serializes them into a
single `<script type="application/ld+json">` (with `<` escaped to `<` to
prevent script-tag breakout / XSS).

Shapes emitted (all `@context: https://schema.org`):

| Type            | Where                              | Source fields |
| --------------- | ---------------------------------- | ------------- |
| `Organization`  | every page + every blog post       | brand name/site name, brand `logoUrl`, origin |
| `WebSite`       | every page + every blog post       | site name, origin |
| `BreadcrumbList`| every page (from request path)     | path segments → `ListItem`s (Home → … ) |
| `Article`       | `/blog/[slug]`                     | post title, seo/excerpt description, ogImage/cover, `publishedAt` (datePublished/dateModified), org as publisher/author |

Origin is derived from the resolved request host (`originForHost` — `http` for
localhost/`.local`, `https` otherwise) so URLs are canonical per tenant. All
relative image/URL fields are absolutized via `absoluteUrl`. When a page/post is
`noindex`, structured data is suppressed.

Wired in:
- `apps/renderer/src/app/[[...slug]]/page.tsx` → `<JsonLd>` with Organization +
  WebSite + BreadcrumbList.
- `apps/renderer/src/app/blog/[slug]/page.tsx` → `<JsonLd>` with Article +
  Organization + WebSite + BreadcrumbList (`/blog/<slug>`).

Verify: `curl` a published page / blog post and grep for `application/ld+json`.

## 2 & 3. Social preview + SEO score (admin)

`apps/admin/src/views/builder/components/seo/`:
- `SeoPreviewPanel.tsx` — a tabbed live preview rendered from the title /
  description / OG-image / slug as the user types: **Google** SERP snippet
  (truncated like real search), **Social card** (Facebook/Twitter OG card with
  image, domain, title, description), and **Score** (a 0–100 ring + pass/warn/fail
  checklist).
- `seoScore.ts` — pure `scoreSeo()` heuristics: title length (30–60), meta
  description presence + length (70–160), OG image set, readable slug, single H1,
  image alt-text hints. Weighted → 0–100 with actionable recommendations.
- `sampleLayout.ts` — `sampleLayoutSeo()` walks the serialized layout node map to
  count H1 headings (`Heading` blocks with `level === 1`) and images missing alt
  (`Image` blocks with `imageUrl` but no `altText`), feeding the score.

Wired into `apps/admin/src/views/builder/components/PageSettingsDialog.tsx` (the
existing page SEO editor — title/description/canonical/ogImage/noindex). The panel
updates on every keystroke; `baseUrl`/site name come from `useActiveSite`.
`generateMetadata` already emits OG + `summary_large_image` Twitter tags.

## 4. Auto-301 on slug change

In `apps/api/src/modules/pages/pages.service.ts` `update()`: when a **published**
page's slug or parent changes, the OLD public path is resolved BEFORE the write
(`resolvePagePath` — mirrors the renderer's home→`/` + parent-chain rule, cycle-
guarded), then after the write the NEW path is resolved and a 301 is created via
`RedirectsService.create()` (`createSlugChangeRedirect`). That call already
enforces duplicate (`UNIQUE(siteId, fromPath)`), self-loop, and chain-loop guards,
and writes an audit entry; a `page.redirect_created` audit (reason `slug_change`)
is also recorded. Failures (e.g. an existing redirect for that path) are swallowed
so they never break the page update. `RedirectsModule` is imported into
`PagesModule`; both services share the request-scoped `ScopedRepository` (tenant
isolation preserved). The admin `EditSlugDialog` warning now states the redirect
is created automatically.

## 5. Broken-link check

Not implemented (optional) — deferred to avoid over-building.

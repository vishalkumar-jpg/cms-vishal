# RSS / Atom Feeds

Per-site, host-resolved blog feeds served by the renderer. Mirrors the
`sitemap.xml` / `robots.txt` Route Handler pattern (tenant resolved from the
request `Host`, edge-cached, non-HTML response).

## Routes

| Path             | Format   | Content-Type                        |
| ---------------- | -------- | ----------------------------------- |
| `/blog/rss.xml`  | RSS 2.0  | `application/rss+xml; charset=utf-8`  |
| `/feed.xml`      | RSS 2.0  | `application/rss+xml; charset=utf-8`  (root alias) |
| `/feed.atom`     | Atom 1.0 | `application/atom+xml; charset=utf-8` |

Each is a `runtime = "nodejs"` Route Handler (`app/blog/rss.xml/route.ts`,
`app/feed.xml/route.ts`, `app/feed.atom/route.ts`) delegating to the shared
`feedResponse()` in `src/lib/feed-response.ts`.

## Host resolution & data

`feedResponse()`:

1. Resolves the tenant host from `x-forwarded-host` / `host` via
   `normalizeHost()` (same as sitemap/robots).
2. `getSite(host)` — site name + `defaultLocale` for channel metadata. Unknown
   host → `404`.
3. `getPosts(host, undefined, 50)` — the published-post index
   (`/api/v1/public/posts`, which returns **published posts only** — no drafts).
4. `originForHost(host)` → absolute `https://<host>` (http for local) origin so
   every `<link>`/`<guid>`/`<id>` is an absolute URL on the tenant's domain.

## Channel / item mapping (RSS)

Channel: `title = "Blog — <site.name>"`, `link = <origin>/blog`,
`description`, `language = site.defaultLocale ?? "en"`,
`lastBuildDate` = most recent post `publishedAt` (RFC-822, or now if empty),
`generator`, plus an `atom:link rel="self"`.

Per published post `<item>`: `title`, `link` (absolute `/blog/<slug>`),
`guid` (permalink = same URL), `pubDate` (RFC-822 from `publishedAt`),
`description` (excerpt, wrapped in CDATA). Author/category are not on the
public post-card DTO, so they are omitted. Atom mirrors this with
`entry/id/updated/published/summary`.

## XML safety

`src/lib/feed.ts`:
- `escapeXml()` escapes `& < > " '` for text/attribute nodes (titles, links).
- `cdata()` wraps HTML/rich excerpts and safely splits any `]]>` sequence.
- `toRfc822()` (RSS) / `toRfc3339()` (Atom) with invalid/empty-date fallbacks.
- **Empty blog** → a valid feed with channel metadata and zero items.

## Caching

Mirrors the sitemap: `export const revalidate = 3600` and
`Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400`.
Underlying `getSite`/`getPosts` reuse the existing Redis + Next data-cache tiers.

## Autodiscovery

`generateMetadata()` on the blog index (`app/blog/page.tsx`) and post
(`app/blog/[slug]/page.tsx`) sets `alternates.types` so Next emits:

```html
<link rel="alternate" type="application/rss+xml"  title="Blog — <site>" href="/blog/rss.xml">
<link rel="alternate" type="application/atom+xml" title="Blog — <site>" href="/feed.atom">
```

The post page preserves any existing `canonical` alternate.

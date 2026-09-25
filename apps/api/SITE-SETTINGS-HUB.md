# Site Settings Hub (backlog #32 integrations + #31 CDN cache)

Per-site **integrations** and **CDN cache controls**, stored on the existing
`site_settings` singleton (1:1 with a site) and edited from the admin
`/settings` screen.

## Storage — `site_settings` (migration `0015_site_settings_hub.sql`)

Two new nullable `jsonb` columns:

```ts
// integrations
{
  ga4MeasurementId?: string;   // "G-XXXXXXXXXX"
  gtmId?: string;              // "GTM-XXXXXXX"
  liveChatId?: string;         // Tawk.to property/widget id
  headScripts?: string;        // raw admin-authored HTML → <head>
  bodyScripts?: string;        // raw admin-authored HTML → end of <body>
}

// cdn
{
  defaultTtlSeconds?: number;          // edge TTL when no rule matches
  rules?: { pattern: string; ttl: number }[];
}
```

Back-compat: GA4/chat ids are mirrored into the legacy `ga4TrackingId` /
`tawkToId` columns on every integrations save, and reads fall back to those
columns when the jsonb is empty.

## API (all `@Roles("site_admin")`, audited; `:siteId` in path + TenantGuard)

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/v1/sites/:siteId/integrations` | Read integrations (legacy fallback) |
| PUT  | `/api/v1/sites/:siteId/integrations` | Replace integrations (purges render cache) |
| GET  | `/api/v1/sites/:siteId/cdn` | Read CDN config |
| PUT  | `/api/v1/sites/:siteId/cdn` | Replace CDN config (store-only in MVP) |
| POST | `/api/v1/sites/:siteId/cache/purge` | Enqueue a render-cache purge |

`POST .../cache/purge` body: `{ scope?: "all" | "path", path?: string }`.
It enqueues the **existing** cache-purge job (`QueueService.enqueueCachePurge`,
`entity: "chrome"`). The worker (`cache-purge.processor`) deletes the targeted
page key and SCAN-sweeps every `render:<siteId>:*` key — so `scope: "all"`
clears the whole site and `scope: "path"` targets one path's page key (plus the
sweep). DTOs cap script length (20 KB) and validate CDN ttl/rules.

## Public exposure — `GET /api/v1/public/site`

`PublicRenderService.site()` now returns an `integrations` object next to
`settings`/`chrome`, containing only the set fields (GA4/GTM/chat ids +
head/body scripts). The CRM secret is never exposed. The key is cached under
`render:<siteId>:site` and purged on any integrations save.

## Renderer injection — `apps/renderer`

`components/site-integrations.tsx`:
- `SiteIntegrationScripts` (rendered near the top of the page wrapper, after the
  SEO JSON-LD — JSON-LD is untouched):
  - `ga4MeasurementId` → `next/script` `afterInteractive` gtag loader
    (`https://www.googletagmanager.com/gtag/js?id=…`) + inline `gtag('config', …)`.
  - `gtmId` → GTM container loader (`afterInteractive`).
  - `liveChatId` → Tawk.to widget loader (`afterInteractive`).
  - `headScripts` → raw HTML injected verbatim (admin-trusted).
- `BodyIntegrationScripts` (rendered at the end of the wrapper) → `bodyScripts`
  raw HTML.

All parts are conditional and SSR-safe: a site **without** integrations renders
none of this (no regression), and existing SEO JSON-LD is always emitted first.

## Admin — `/settings`

`views/settings/Settings.tsx` — one "Settings" sidebar entry (last item under
**SITE**), tabs **Integrations** (GA4/GTM/chat ids + head/body script textareas
with a "runs on every page" warning) and **CDN** (default TTL + path-rule editor
+ a "Purge cache" button with scope all/path). Saves through the wrapped hooks in
`hooks/useSettings.ts`; toast feedback on success/error.

import { cache } from "react";
import { migrate, type SerializedLayout, type PageSeo } from "@ob-cms/block-schema";
import { publicGet, publicApiPath } from "./api-client";
import { cacheGet, cacheSet } from "./redis";
import { renderKey, pageTag } from "./cache-keys";
import { isrRevalidateSeconds } from "./env";
import type { PublicPage, PublicPageAlternate } from "./public-api-types";

/**
 * Published-page data for (host, path). Returns a migrated-to-current layout
 * plus SEO. `null` → no published page → route renders `notFound()`.
 *
 * Caching: Redis page cache keyed `render:<siteId>:<path>` (cross-instance) in
 * front of the Next fetch data cache (ISR). The cached payload is the RAW API
 * page (pre-migrate) so a schema bump invalidates correctly via `migrate()` on
 * read — cheap and keeps the cache schema-agnostic.
 */

const RENDER_TTL = 120; // 2 min Redis TTL; on-demand purge clears immediately.

export interface RenderPage {
  layout: SerializedLayout;
  seo: PageSeo;
  schemaVersion: string;
  /** i18n (B13): locale actually served + alternates for hreflang. Optional. */
  locale?: string;
  defaultLocale?: string;
  alternates?: PublicPageAlternate[];
}

/**
 * Published-page data for (host, path, locale). i18n (B13): `locale` is the
 * active locale resolved from the URL (default when no prefix). It's forwarded
 * to the API and folded into the cache key so each locale caches separately.
 * Defaults to a single-locale fetch when omitted (full back-compat).
 */
export const getPage = cache(
  async (
    host: string,
    siteId: string,
    path: string,
    locale?: string,
  ): Promise<RenderPage | null> => {
    const key = locale ? `${renderKey(siteId, path)}:${locale}` : renderKey(siteId, path);

    let raw: PublicPage | null = null;
    const cached = await cacheGet(key);
    if (cached) {
      try {
        raw = JSON.parse(cached) as PublicPage;
      } catch {
        raw = null;
      }
    }

    if (!raw) {
      const qs = `path=${encodeURIComponent(path)}${locale ? `&locale=${encodeURIComponent(locale)}` : ""}`;
      raw = await publicGet<PublicPage>(publicApiPath(`/page?${qs}`), {
        host,
        revalidate: isrRevalidateSeconds(),
        tags: [pageTag(siteId, path)],
      });
      if (!raw) return null;
      await cacheSet(key, JSON.stringify(raw), RENDER_TTL);
    }

    // Always migrate/repair on read — editor↔renderer parity (TECH-ARCH §2.4).
    const layout = migrate(raw.layout);
    return {
      layout,
      seo: raw.seo,
      schemaVersion: raw.schemaVersion,
      locale: raw.locale,
      defaultLocale: raw.defaultLocale,
      alternates: raw.alternates,
    };
  },
);

/**
 * Normalize a catch-all `slug[]` (already URL-decoded by Next) into a canonical
 * leading-slash path (e.g. ["a","b"] → "/a/b"). The API client re-encodes when
 * building the query string; cache keys use this canonical form.
 */
export function slugToPath(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) return "/";
  return "/" + slug.join("/");
}

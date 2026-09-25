/**
 * Centralized Redis cache-key scheme + tags so the page layer and the
 * revalidation route agree on what to purge. Documented in WAVE3A.md.
 *
 *   site:<host>              → cached PublicSite JSON
 *   nav:<siteId>             → cached PublicNavigation JSON
 *   redirect:<host>:<path>   → cached redirect lookup ("null" sentinel allowed)
 *   render:<siteId>:<path>   → cached rendered-page payload (layout+seo)
 *
 * Next.js fetch cache tags mirror these for `revalidateTag`:
 *   site:<host>, page:<siteId>:<path>, nav:<siteId>
 */

export const siteKey = (host: string): string => `site:${host}`;
export const navKey = (siteId: string): string => `nav:${siteId}`;
export const redirectKey = (host: string, path: string): string =>
  `redirect:${host}:${path}`;
export const renderKey = (siteId: string, path: string): string =>
  `render:${siteId}:${path}`;

export const siteTag = (host: string): string => `site:${host}`;
export const pageTag = (siteId: string, path: string): string =>
  `page:${siteId}:${path}`;
export const navTag = (siteId: string): string => `nav:${siteId}`;

/** Glob to purge every render entry for a site. */
export const renderSiteGlob = (siteId: string): string => `render:${siteId}:*`;

import type { PublicSite } from "./public-api-types";

/**
 * i18n (B13) URL-scheme helpers for the public renderer.
 *
 * URL scheme:
 *   - the site's DEFAULT locale is served WITHOUT a prefix (`/about`, `/`).
 *   - every other locale is prefixed with its code (`/es/about`, `/es`).
 *
 * The catch-all route receives the full `slug[]`. We peel a leading segment off
 * IFF it matches one of the site's non-default locales; the remainder is the
 * locale-agnostic content path the API resolves against.
 */

/** The site's locale set, tolerant of older single-locale payloads. */
export function siteLocales(site: PublicSite): { defaultLocale: string; locales: string[] } {
  const defaultLocale = (site.defaultLocale || "en").toLowerCase();
  const locales =
    site.locales && site.locales.length > 0
      ? site.locales.map((l) => l.toLowerCase())
      : [defaultLocale];
  return { defaultLocale, locales };
}

/**
 * Split a catch-all `slug[]` into a `{ locale, path }`. If the first segment is
 * a NON-DEFAULT site locale it's consumed as the active locale and the rest is
 * the content path; otherwise the default locale is used and the whole slug is
 * the path. Default-locale URLs therefore never carry a prefix (back-compat).
 */
export function resolveLocaleFromSlug(
  slug: string[] | undefined,
  site: PublicSite,
): { locale: string; path: string } {
  const { defaultLocale, locales } = siteLocales(site);
  const segments = slug ?? [];
  const first = segments[0]?.toLowerCase();
  if (first && first !== defaultLocale && locales.includes(first)) {
    const rest = segments.slice(1);
    return { locale: first, path: rest.length ? `/${rest.join("/")}` : "/" };
  }
  return { locale: defaultLocale, path: segments.length ? `/${segments.join("/")}` : "/" };
}

/**
 * Build an absolute alternate URL for a hreflang link from an origin + a public
 * path the API returned (already prefixed for non-default locales).
 */
export function alternateUrl(origin: string, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${clean === "/" ? "" : clean}` || origin;
}

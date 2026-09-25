import { cache } from "react";
import { publicGet, publicApiPath } from "./api-client";
import { cacheGet, cacheSet } from "./redis";
import { siteKey, siteTag, navKey, navTag } from "./cache-keys";
import { isrRevalidateSeconds } from "./env";
import type { PublicSite, PublicNavigation } from "./public-api-types";

/**
 * Tenant + global-site data. Two cache tiers:
 *   1. React `cache()` — dedupes within a single SSR pass.
 *   2. Redis (best-effort) — shares across instances/requests.
 *   3. Next fetch data cache (ISR) — origin-level fallback.
 *
 * Unknown host → API 404 → `null` here → the route renders `notFound()`.
 */

const SITE_TTL = 300; // 5 min; purged on demand via the revalidate route.

/** Resolve the site/theme for a public host. Cached per request + in Redis. */
export const getSite = cache(async (host: string): Promise<PublicSite | null> => {
  const cached = await cacheGet(siteKey(host));
  if (cached) {
    try {
      return JSON.parse(cached) as PublicSite;
    } catch {
      /* fall through to origin */
    }
  }

  const site = await publicGet<PublicSite>(publicApiPath("/site"), {
    host,
    revalidate: isrRevalidateSeconds(),
    tags: [siteTag(host)],
  });
  if (!site) return null;

  await cacheSet(siteKey(host), JSON.stringify(site), SITE_TTL);
  return site;
});

/** Resolve header/footer navigation for a site. Cached per request + in Redis. */
export const getNavigation = cache(
  async (host: string, siteId: string): Promise<PublicNavigation> => {
    const empty: PublicNavigation = { header: [], footer: [] };

    const cached = await cacheGet(navKey(siteId));
    if (cached) {
      try {
        return JSON.parse(cached) as PublicNavigation;
      } catch {
        /* fall through */
      }
    }

    const nav = await publicGet<PublicNavigation>(publicApiPath("/navigation"), {
      host,
      revalidate: isrRevalidateSeconds(),
      tags: [navTag(siteId)],
    });
    const value = nav ?? empty;
    await cacheSet(navKey(siteId), JSON.stringify(value), SITE_TTL);
    return value;
  },
);

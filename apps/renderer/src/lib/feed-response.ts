import { NextResponse, type NextRequest } from "next/server";
import { isStagingDeployment, STAGING_X_ROBOTS_TAG } from "./indexing-policy";
import { normalizeHost } from "./host";
import { getSite } from "./site-data";
import { getPosts } from "./post-data";
import { originForHost } from "./structured-data";
import { buildRssFeed, buildAtomFeed } from "./feed";

/**
 * Shared feed Route Handler. Resolves the tenant from the request Host (mirrors
 * sitemap/robots), fetches the site + published-post index, and renders an RSS
 * or Atom document with absolute URLs to that tenant's domain.
 *
 * Caching mirrors the sitemap: `s-maxage` + stale-while-revalidate at the edge.
 * Unknown host → 404. Empty blog → a valid empty feed.
 */
export async function feedResponse(
  req: NextRequest,
  kind: "rss" | "atom",
): Promise<NextResponse> {
  // UAT/staging feeds must not expose crawlable URL lists to search engines.
  if (isStagingDeployment()) {
    return new NextResponse("Not found", {
      status: 404,
      headers: {
        "cache-control": "private, no-store",
        "X-Robots-Tag": STAGING_X_ROBOTS_TAG,
      },
    });
  }

  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );

  const site = await getSite(host);
  if (!site) {
    return new NextResponse("Not found", { status: 404 });
  }

  const posts = await getPosts(host, undefined, 50);
  const origin = originForHost(host);

  const body =
    kind === "rss"
      ? buildRssFeed({ site, posts, origin })
      : buildAtomFeed({ site, posts, origin });

  const contentType =
    kind === "rss"
      ? "application/rss+xml; charset=utf-8"
      : "application/atom+xml; charset=utf-8";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

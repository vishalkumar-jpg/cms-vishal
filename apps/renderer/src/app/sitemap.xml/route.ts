import { NextResponse, type NextRequest } from "next/server";
import { isStagingDeployment, STAGING_X_ROBOTS_TAG } from "@/lib/indexing-policy";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600; // sitemap changes infrequently.

/**
 * Proxy the API's host-resolved `/sitemap.xml` so the public site serves it at
 * its own root. The incoming public Host is forwarded so the API emits the
 * correct tenant's sitemap.
 *
 * UAT/staging (`ENVIRONMENT=staging`): returns 404 — UAT must never expose an
 * indexable sitemap or UAT URLs to search engines.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
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

  try {
    const upstream = await fetch(`${internalApiUrl()}/sitemap.xml`, {
      headers: { host, "x-forwarded-host": host, accept: "application/xml" },
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return new NextResponse("Not found", { status: upstream.status === 404 ? 404 : 502 });
    }

    const body = await upstream.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/xml; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 502 });
  }
}

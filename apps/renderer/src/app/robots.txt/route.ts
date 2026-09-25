import { NextResponse, type NextRequest } from "next/server";
import {
  isStagingDeployment,
  STAGING_X_ROBOTS_TAG,
  stagingRobotsTxt,
} from "@/lib/indexing-policy";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Proxy the API's host-resolved `/robots.txt` to the public site root. Forwards
 * the incoming Host so the API returns the correct tenant's robots policy.
 *
 * UAT/staging (`ENVIRONMENT=staging`): serves a block-all robots.txt locally —
 * never proxies production robots rules and never references a sitemap.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isStagingDeployment()) {
    return new NextResponse(stagingRobotsTxt(), {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "private, no-store",
        "X-Robots-Tag": STAGING_X_ROBOTS_TAG,
      },
    });
  }

  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );

  try {
    const upstream = await fetch(`${internalApiUrl()}/robots.txt`, {
      headers: { host, "x-forwarded-host": host, accept: "text/plain" },
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      // Fail safe: serve a permissive default rather than 500.
      return new NextResponse("User-agent: *\nAllow: /\n", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const body = await upstream.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse("User-agent: *\nAllow: /\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

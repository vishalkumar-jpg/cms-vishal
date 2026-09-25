import { NextResponse, type NextRequest } from "next/server";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";

/**
 * Same-origin proxy for ONE published collection item (host-resolved). Mirrors
 * the items list proxy — forwards the tenant Host to
 * `/api/v1/public/collections/:slug/items/:itemSlug`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; itemSlug: string }> },
): Promise<NextResponse> {
  const { slug, itemSlug } = await params;
  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );

  const upstream = await fetch(
    `${internalApiUrl()}/api/v1/public/collections/${encodeURIComponent(slug)}/items/${encodeURIComponent(itemSlug)}`,
    {
      headers: { host, "x-forwarded-host": host, accept: "application/json" },
      next: { revalidate: 30 },
    },
  );

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.ok ? 200 : upstream.status === 404 ? 404 : 502,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=30, stale-while-revalidate=300",
    },
  });
}

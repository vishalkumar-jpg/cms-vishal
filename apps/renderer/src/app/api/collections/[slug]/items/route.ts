import { NextResponse, type NextRequest } from "next/server";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";

/**
 * Same-origin proxy for a collection's published items. The Collection List
 * block (a Client Component on the published site) fetches
 * `/api/collections/:slug/items` on the tenant host; we forward the incoming
 * Host to the host-resolved API (`/api/v1/public/collections/:slug/items`) so it
 * returns the right tenant's items. Mirrors the forms proxy pattern.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );

  const url = new URL(req.url);
  const qs = new URLSearchParams();
  const limit = url.searchParams.get("limit");
  const sort = url.searchParams.get("sort");
  if (limit) qs.set("limit", limit);
  if (sort) qs.set("sort", sort);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const upstream = await fetch(
    `${internalApiUrl()}/api/v1/public/collections/${encodeURIComponent(slug)}/items${suffix}`,
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

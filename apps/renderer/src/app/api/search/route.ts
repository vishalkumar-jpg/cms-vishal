import { NextResponse, type NextRequest } from "next/server";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";

/**
 * Same-origin proxy for the public on-site search (#64). The Search block (a
 * Client Component on the published site) fetches `/api/search?q=…` on the
 * tenant host; we forward the incoming Host to the host-resolved API
 * (`/api/v1/public/search`) so it returns only THAT tenant's published results.
 * Mirrors the forms-definition proxy.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const type = req.nextUrl.searchParams.get("type");
  const limit = req.nextUrl.searchParams.get("limit");
  const upstreamUrl = new URL(`${internalApiUrl()}/api/v1/public/search`);
  upstreamUrl.searchParams.set("q", q);
  if (type) upstreamUrl.searchParams.set("type", type);
  if (limit) upstreamUrl.searchParams.set("limit", limit);

  const upstream = await fetch(upstreamUrl, {
    headers: { host, "x-forwarded-host": host, accept: "application/json" },
    // Public + cacheable; brief revalidate keeps freshly published content close.
    next: { revalidate: 30 },
  });

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.ok ? 200 : upstream.status === 404 ? 404 : 502,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
    },
  });
}

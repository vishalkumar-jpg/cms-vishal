import { NextResponse, type NextRequest } from "next/server";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";

/**
 * Same-origin proxy for a public reusable-block layout (REUSE-BLOCKS). The
 * ReusableBlock component (a Client Component on the published site) fetches
 * `/api/reusable-blocks/:id` on the tenant host; we forward the incoming Host to
 * the host-resolved API (`/api/v1/public/reusable-blocks/:id`) so it returns the
 * right tenant's block. Mirrors the forms proxy.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );

  const upstream = await fetch(
    `${internalApiUrl()}/api/v1/public/reusable-blocks/${encodeURIComponent(id)}`,
    {
      headers: { host, "x-forwarded-host": host, accept: "application/json" },
      // Reusable blocks are public + cacheable; brief revalidate keeps edits fresh.
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

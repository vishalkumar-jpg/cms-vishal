import { NextResponse, type NextRequest } from "next/server";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";

/**
 * Same-origin proxy for an experiment's public variant defs (Phase 4 A/B). The
 * Experiment block (a Client Component on the published site) fetches
 * `/api/experiments/public/:id` on the tenant host; we forward the incoming Host
 * to the host-resolved API so it returns the correct tenant's experiment (status
 * + variant keys/weights). The block then assigns a variant deterministically.
 * Mirrors the collections-items proxy.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );

  let upstream: Response;
  try {
    upstream = await fetch(
      `${internalApiUrl()}/api/v1/experiments/public/${encodeURIComponent(id)}`,
      {
        headers: { host, "x-forwarded-host": host, accept: "application/json" },
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.ok ? 200 : upstream.status === 404 ? 404 : 502,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      // Short cache: variant defs change rarely, but status flips must propagate.
      "cache-control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
    },
  });
}

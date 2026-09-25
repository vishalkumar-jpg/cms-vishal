import { NextResponse, type NextRequest } from "next/server";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";

/**
 * Same-origin proxy for visitor→audiences personalization (Phase 4). A published
 * page resolves the current visitor's audience membership set (for
 * `visibleIf: audience`) by calling `/api/experiments/personalize/audiences?visitorId=`
 * on the tenant host; we forward the incoming Host to the host-resolved API. The
 * response is `{ data: { audiences: string[] } }`.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );
  const visitorId = new URL(req.url).searchParams.get("visitorId") ?? "";

  let upstream: Response;
  try {
    upstream = await fetch(
      `${internalApiUrl()}/api/v1/experiments/personalize/audiences?visitorId=${encodeURIComponent(visitorId)}`,
      {
        headers: { host, "x-forwarded-host": host, accept: "application/json" },
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json({ data: { audiences: [] } }, { status: 200 });
  }

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.ok ? 200 : 502,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

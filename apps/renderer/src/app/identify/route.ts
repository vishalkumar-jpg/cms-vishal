import { NextResponse, type NextRequest } from "next/server";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";

/**
 * Same-origin identify beacon proxy (Phase 3). A client can POST
 * `{ visitorId, email }` to `/identify` on the tenant host (e.g. after a known
 * sign-in); we forward the incoming Host + JSON body to the host-resolved API
 * (`/api/v1/identify`) so the identity lands on the correct tenant. Mirrors the
 * `/collect` beacon proxy: always replies 204 (fire-and-forget) so a failed
 * upstream never surfaces to the visitor's browser.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );

  let body = "";
  try {
    body = await req.text();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await fetch(`${internalApiUrl()}/api/v1/identify`, {
      method: "POST",
      headers: {
        host,
        "x-forwarded-host": host,
        "content-type": "application/json",
        accept: "application/json",
      },
      body,
      cache: "no-store",
    });
  } catch {
    /* best-effort — swallow upstream errors */
  }

  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}

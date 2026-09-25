import { NextResponse, type NextRequest } from "next/server";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";

/**
 * Same-origin analytics beacon proxy (Phase 2a). The renderer tracker POSTs a
 * batch to `/collect` on the tenant host (via navigator.sendBeacon); we forward
 * the incoming Host + JSON body to the host-resolved API (`/api/v1/collect`) so the
 * events land on the correct tenant. Mirrors the forms-submit proxy. Always
 * replies 204 (fire-and-forget) — a failed upstream must never surface an error
 * to the visitor's browser.
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
    await fetch(`${internalApiUrl()}/api/v1/collect`, {
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

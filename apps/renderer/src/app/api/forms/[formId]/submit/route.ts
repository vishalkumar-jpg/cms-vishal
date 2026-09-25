import { NextResponse, type NextRequest } from "next/server";
import { internalApiUrl } from "@/lib/env";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";

/**
 * Same-origin proxy for a public form submission. The Form block POSTs to
 * `/api/forms/:id/submit` on the tenant host; we forward the incoming Host and
 * the JSON body to the host-resolved API (`/api/v1/public/forms/:id/submit`) so the
 * submission lands on the correct tenant (→ existing forms→CRM pipeline).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
): Promise<NextResponse> {
  const { formId } = await params;
  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );

  const body = await req.text();

  const upstream = await fetch(
    `${internalApiUrl()}/api/v1/public/forms/${encodeURIComponent(formId)}/submit`,
    {
      method: "POST",
      headers: {
        host,
        "x-forwarded-host": host,
        "content-type": "application/json",
        accept: "application/json",
      },
      body,
      cache: "no-store",
    },
  );

  const resBody = await upstream.text();
  return new NextResponse(resBody, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

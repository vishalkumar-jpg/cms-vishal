import { type NextRequest } from "next/server";
import { feedResponse } from "@/lib/feed-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600; // feed changes with new posts; short edge TTL.

/** RSS 2.0 feed for the tenant's blog, host-resolved. */
export function GET(req: NextRequest) {
  return feedResponse(req, "rss");
}

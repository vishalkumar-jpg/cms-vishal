import { type NextRequest } from "next/server";
import { feedResponse } from "@/lib/feed-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600;

/** Root-level RSS 2.0 alias of /blog/rss.xml (common reader default path). */
export function GET(req: NextRequest) {
  return feedResponse(req, "rss");
}

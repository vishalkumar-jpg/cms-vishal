import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { revalidateSecret } from "@/lib/env";
import { cacheDel } from "@/lib/redis";
import {
  renderKey,
  renderSiteGlob,
  siteKey,
  navKey,
  pageTag,
  siteTag,
  navTag,
} from "@/lib/cache-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * On-demand revalidation / cache-purge endpoint. The API's publish + cache-purge
 * flow calls this to (a) clear the renderer's Redis page cache and (b) trigger
 * Next.js ISR revalidation for the affected path(s)/tag(s).
 *
 * ── Contract (also in WAVE3A.md) ──────────────────────────────────────────────
 * POST /api/revalidate
 *   Auth: `x-revalidate-secret: <REVALIDATE_SECRET>` header OR `?secret=`.
 *   Body (JSON):
 *     {
 *       siteId: string,           // required: tenant whose cache to purge
 *       host?: string,            // host used as the public host / site cache key
 *       paths?: string[],         // canonical paths e.g. ["/", "/pricing"]
 *       purgeSite?: boolean,      // also drop site-resolution + nav caches
 *       purgeAll?: boolean        // drop ALL render:<siteId>:* entries
 *     }
 *   Response: { revalidated: true, siteId, paths, purgedSite, purgedAll }
 *
 * Idempotent and best-effort: Redis failures never fail the request (cache miss
 * just re-hydrates from origin on next read).
 */

interface RevalidateBody {
  siteId?: string;
  host?: string;
  paths?: string[];
  purgeSite?: boolean;
  purgeAll?: boolean;
}

function authorized(req: NextRequest): boolean {
  const secret = revalidateSecret();
  if (!secret) return false; // refuse if not configured — fail closed.
  const header = req.headers.get("x-revalidate-secret");
  const query = req.nextUrl.searchParams.get("secret");
  return header === secret || query === secret;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: RevalidateBody;
  try {
    body = (await req.json()) as RevalidateBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { siteId, host, paths = [], purgeSite = false, purgeAll = false } = body;
  if (!siteId) {
    return NextResponse.json({ message: "siteId is required" }, { status: 400 });
  }

  // 1. Redis purge.
  if (purgeAll) {
    await cacheDel(renderSiteGlob(siteId));
  } else {
    for (const p of paths) {
      await cacheDel(renderKey(siteId, p));
    }
  }
  if (purgeSite) {
    if (host) await cacheDel(siteKey(host));
    await cacheDel(navKey(siteId));
  }

  // 2. Next.js ISR revalidation (tags + paths).
  for (const p of paths) {
    revalidateTag(pageTag(siteId, p));
    try {
      revalidatePath(p);
    } catch {
      /* path may not be cached yet */
    }
  }
  if (purgeSite) {
    if (host) revalidateTag(siteTag(host));
    revalidateTag(navTag(siteId));
  }
  if (purgeAll) {
    // Revalidate the whole catch-all segment for this deployment.
    try {
      revalidatePath("/", "layout");
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    revalidated: true,
    siteId,
    paths,
    purgedSite: purgeSite,
    purgedAll: purgeAll,
  });
}

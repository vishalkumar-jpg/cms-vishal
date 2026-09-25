import { cookies } from "next/headers";
import { internalApiUrl } from "./env";
import type { ApiEnvelope } from "./public-api-types";

/**
 * Phase 4 personalization — server-side visitor audience resolution.
 *
 * The visitor's first-party id lives in `localStorage["ob_vid"]` (analytics
 * tracker). For SSR audience gating (`visibleIf: audience`) the tracker also
 * MIRRORS that id into a first-party `ob_vid` cookie, so the RSC page can read it
 * here (`cookies()`) and resolve the visitor's audience membership set from the
 * host-resolved API. When the cookie is absent (a brand-new visitor whose first
 * request has no cookie yet), we resolve to the empty set — an `in` condition
 * then fails and a `not-in` passes, and the block re-resolves on the next
 * navigation once the cookie is set. This keeps the render pure + SSR-safe with
 * no client flash for returning visitors.
 */

const VISITOR_COOKIE = "ob_vid";

export async function resolveVisitorAudiences(host: string): Promise<{
  visitorId: string | null;
  audiences: string[];
}> {
  let visitorId: string | null = null;
  try {
    const store = await cookies();
    visitorId = store.get(VISITOR_COOKIE)?.value ?? null;
  } catch {
    visitorId = null;
  }
  if (!visitorId) return { visitorId: null, audiences: [] };

  try {
    const res = await fetch(
      `${internalApiUrl()}/api/v1/experiments/personalize/audiences?visitorId=${encodeURIComponent(visitorId)}`,
      {
        headers: { host, "x-forwarded-host": host, accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return { visitorId, audiences: [] };
    const json = (await res.json()) as ApiEnvelope<{ audiences: string[] }>;
    return { visitorId, audiences: json.data?.audiences ?? [] };
  } catch {
    return { visitorId, audiences: [] };
  }
}

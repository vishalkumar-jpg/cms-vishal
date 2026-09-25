import { PUBLIC_API_PREFIX } from "@ob-cms/shared";

import { internalApiUrl } from "./env";
import type { ApiEnvelope } from "./public-api-types";

/**
 * Thin fetch wrapper for the internal `/api/v1/public/*` endpoints. Always forwards
 * the incoming public Host header so the API resolves the correct tenant.
 *
 * Uses the Next.js `fetch` data cache (revalidate/tags) as the first-line cache
 * layer; the Redis layer in page-data.ts sits in front for cross-instance reuse.
 */

export interface PublicFetchOptions {
  /** Public host of the incoming request (forwarded so the API picks the tenant). */
  host: string;
  /** ISR seconds for the Next data cache. `false` disables caching. */
  revalidate?: number | false;
  /** Cache tags for on-demand `revalidateTag`. */
  tags?: string[];
}

export class ApiNotFoundError extends Error {
  constructor(public path: string) {
    super(`Public API 404: ${path}`);
    this.name = "ApiNotFoundError";
  }
}

/** Build a versioned public API path, e.g. `"/site"` → `/api/v1/public/site`. */
export function publicApiPath(suffix: string): string {
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${PUBLIC_API_PREFIX}${normalized}`;
}

/**
 * GET a `/api/v1/public/*` path and unwrap the `{ data }` envelope.
 * Returns `null` on 404 (callers map that to a Next 404). Throws on other
 * non-2xx so ISR doesn't cache a broken page.
 */
export async function publicGet<T>(
  path: string,
  opts: PublicFetchOptions,
): Promise<T | null> {
  const url = `${internalApiUrl()}${path}`;
  const next: { revalidate?: number | false; tags?: string[] } = {};
  if (opts.revalidate !== undefined) next.revalidate = opts.revalidate;
  if (opts.tags) next.tags = opts.tags;

  const res = await fetch(url, {
    headers: {
      // Forward the tenant host. The API trusts x-forwarded-host from the edge.
      host: opts.host,
      "x-forwarded-host": opts.host,
      accept: "application/json",
    },
    next,
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Public API ${res.status} for ${path}`);
  }

  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

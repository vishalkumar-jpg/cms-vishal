import { PUBLIC_API_PREFIX } from "@ob-cms/shared";

import { migrate, type SerializedLayout, type PageSeo } from "@ob-cms/block-schema";
import { internalApiUrl } from "./env";
import type { ApiEnvelope } from "./public-api-types";

/**
 * CONTENT-OPS — token-gated DRAFT preview data (no login).
 *
 * Fetches `/api/v1/public/preview/{type}/{id}?token=…` on the API. The preview is a
 * capability: a valid token returns the DRAFT layout (migrated to the current
 * schema). NEVER cached (no-store) so an editor always sees the latest draft, and
 * so a revoked token stops working immediately. Distinguishes:
 *   - null       → not found (404) OR forbidden (403 wrong/revoked token),
 *   - the payload → a valid preview.
 * The route maps `null` to Next's notFound(); we deliberately don't leak whether
 * the entity exists when the token is wrong (both surface as "not found").
 */

export interface PreviewContent {
  id: string;
  slug: string;
  title: string;
  layout: SerializedLayout;
  seo: PageSeo;
  excerpt?: string | null;
  coverUrl?: string | null;
  locale?: string;
}

interface RawPreview {
  id: string;
  slug: string;
  title: string;
  layout: SerializedLayout;
  seo: PageSeo;
  excerpt?: string | null;
  coverUrl?: string | null;
  locale?: string;
}

export async function getPreview(
  host: string,
  type: "page" | "post",
  id: string,
  token: string,
): Promise<PreviewContent | null> {
  if (!token) return null;
  const url = `${internalApiUrl()}${PUBLIC_API_PREFIX}/preview/${type}/${encodeURIComponent(
    id,
  )}?token=${encodeURIComponent(token)}`;

  const res = await fetch(url, {
    headers: {
      host,
      "x-forwarded-host": host,
      accept: "application/json",
    },
    cache: "no-store",
  });

  // 403 (bad/revoked token) and 404 (missing) both surface as "not found" so a
  // wrong token can't probe for existence.
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Preview API ${res.status} for ${type}/${id}`);

  const json = (await res.json()) as ApiEnvelope<RawPreview>;
  const raw = json.data;
  if (!raw) return null;
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    layout: migrate(raw.layout),
    seo: raw.seo,
    excerpt: raw.excerpt ?? null,
    coverUrl: raw.coverUrl ?? null,
    locale: raw.locale,
  };
}

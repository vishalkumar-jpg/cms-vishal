import { cache } from "react";
import { migrate, type SerializedLayout } from "@ob-cms/block-schema";
import { publicGet, publicApiPath } from "./api-client";
import { isrRevalidateSeconds } from "./env";
import type { PublicPost, PublicPostCard } from "./public-api-types";

/**
 * Public blog data. The published-post index + a single published post. Uses the
 * Next.js fetch data cache (ISR) keyed by tag so a publish→cache-purge can
 * revalidate. The API layer also keeps a short Redis cache.
 */

/** Published-post index for the host. Optional `term` slug filter. */
export const getPosts = cache(
  async (host: string, term?: string, limit = 24): Promise<PublicPostCard[]> => {
    const qs = new URLSearchParams();
    if (term) qs.set("term", term);
    qs.set("limit", String(limit));
    const data = await publicGet<PublicPostCard[]>(publicApiPath(`/posts?${qs.toString()}`), {
      host,
      revalidate: isrRevalidateSeconds(),
      tags: ["posts"],
    });
    return data ?? [];
  },
);

export interface RenderPost extends Omit<PublicPost, "layout"> {
  layout: SerializedLayout;
}

/**
 * One published post by slug, or `null` (→ route renders notFound()). i18n
 * (B13): an optional `locale` resolves the post in that locale (API falls back
 * to the default locale when the translation is missing). Omitting it keeps the
 * default-locale behavior unchanged.
 */
export const getPost = cache(
  async (host: string, slug: string, locale?: string): Promise<RenderPost | null> => {
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : "";
    const raw = await publicGet<PublicPost>(
      publicApiPath(`/posts/${encodeURIComponent(slug)}${qs}`),
      {
        host,
        revalidate: isrRevalidateSeconds(),
        tags: [`post:${slug}`],
      },
    );
    if (!raw) return null;
    // Always migrate/repair on read — editor↔renderer parity.
    return { ...raw, layout: migrate(raw.layout) };
  },
);

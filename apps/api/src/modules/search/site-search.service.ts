import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  collectionItems,
  collections,
  pages,
  posts,
  siteSettings,
} from "@database/schema";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import { normalizeLocales } from "@modules/sites/sites.service";

/** Public on-site search result type. */
export type SiteSearchType = "page" | "post" | "collection";

/** One public, ranked, host-resolved search hit for the published website. */
export interface SiteSearchHit {
  type: SiteSearchType;
  title: string;
  /** Site-relative URL (renderer is same-origin with the site). */
  url: string;
  /** ts_headline snippet with <mark> around the matched terms (sanitized). */
  snippet: string;
  /** ts_rank score (higher = more relevant). */
  rank: number;
}

/** Hard cap on results returned to the public. */
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

/**
 * SiteSearchService — PUBLIC, host-resolved, Postgres full-text search over the
 * PUBLISHED content of a single site (pages, posts, collection items).
 *
 * Distinct from the admin `SearchService` (ILIKE, X-Site-Id scoped, ⌘K palette):
 * this one resolves the tenant from the Host header via `SiteResolver` (no
 * client-supplied siteId is ever trusted) and filters to `status = 'published'`
 * + `deletedAt IS NULL` for THAT site only, so results never cross tenants and
 * never leak drafts.
 *
 * Uses `websearch_to_tsquery('english', q)` (Google-style syntax) matched with
 * `@@` against the SAME `to_tsvector(...)` expression the GIN indexes were built
 * over (see migration 0029), ordered by `ts_rank`, with `ts_headline` snippets.
 * The `<mark>`/`</mark>` snippet delimiters are the only HTML — everything else
 * is HTML-escaped by ts_headline, so the renderer can render it safely.
 */
@Injectable()
export class SiteSearchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly resolver: SiteResolver,
  ) {}

  async search(
    host: string | undefined,
    q: string,
    type?: string,
    limit?: number,
  ): Promise<SiteSearchHit[]> {
    const term = q?.trim();
    if (!term) return [];
    const site = await this.resolver.resolve(host);
    if (!site) throw new NotFoundException("Site not found for host");

    const max = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const wanted = this.parseType(type);

    // The public blog/pages index serves the DEFAULT locale (mirrors
    // PublicRenderService.posts), so search that locale to keep URLs valid.
    const [settings] = await this.db
      .select({ defaultLocale: siteSettings.defaultLocale, locales: siteSettings.locales })
      .from(siteSettings)
      .where(eq(siteSettings.siteId, site.id))
      .limit(1);
    const { defaultLocale } = normalizeLocales(settings?.defaultLocale, settings?.locales);

    const tasks: Array<Promise<SiteSearchHit[]>> = [];
    if (wanted.has("page")) tasks.push(this.searchPages(site.id, defaultLocale, term, max));
    if (wanted.has("post")) tasks.push(this.searchPosts(site.id, defaultLocale, term, max));
    if (wanted.has("collection")) tasks.push(this.searchCollections(site.id, term, max));

    const hits: SiteSearchHit[] = [];
    for (const group of await Promise.all(tasks)) hits.push(...group);
    // Merge the per-type result sets, best-ranked first, capped overall.
    hits.sort((a, b) => b.rank - a.rank);
    return hits.slice(0, max);
  }

  /** Parse the optional `type` filter (CSV); default = all public types. */
  private parseType(type?: string): Set<SiteSearchType> {
    const all: SiteSearchType[] = ["page", "post", "collection"];
    if (!type?.trim()) return new Set(all);
    const requested = type
      .split(",")
      .map((t) => t.trim())
      .filter((t): t is SiteSearchType => (all as string[]).includes(t));
    return requested.length > 0 ? new Set(requested) : new Set(all);
  }

  private async searchPages(
    siteId: string,
    locale: string,
    term: string,
    max: number,
  ): Promise<SiteSearchHit[]> {
    // Document expression MUST match the GIN index in migration 0029.
    const doc = sql`(
      coalesce(${pages.title}, '') || ' ' ||
      coalesce(${pages.slug}, '') || ' ' ||
      coalesce(${pages.seo}::text, '') || ' ' ||
      coalesce(${pages.publishedLayout}::text, '')
    )`;
    const query = sql`websearch_to_tsquery('english', ${term})`;
    const rows = await this.db
      .select({
        title: pages.title,
        slug: pages.slug,
        rank: sql<number>`ts_rank(to_tsvector('english', ${doc}), ${query})`,
        snippet: sql<string>`ts_headline('english', coalesce(${pages.title}, '') || ' — ' || coalesce(${pages.seo}->>'description', ''), ${query}, 'StartSel=<mark>,StopSel=</mark>,MaxFragments=2,MaxWords=30,MinWords=10')`,
      })
      .from(pages)
      .where(
        and(
          eq(pages.siteId, siteId),
          eq(pages.locale, locale),
          eq(pages.status, "published"),
          isNull(pages.deletedAt),
          sql`to_tsvector('english', ${doc}) @@ ${query}`,
        ),
      )
      .orderBy(sql`ts_rank(to_tsvector('english', ${doc}), ${query}) DESC`)
      .limit(max);
    return rows.map((r) => ({
      type: "page" as const,
      title: r.title,
      url: this.pageUrl(r.slug),
      snippet: r.snippet ?? "",
      rank: Number(r.rank) || 0,
    }));
  }

  private async searchPosts(
    siteId: string,
    locale: string,
    term: string,
    max: number,
  ): Promise<SiteSearchHit[]> {
    const doc = sql`(
      coalesce(${posts.title}, '') || ' ' ||
      coalesce(${posts.slug}, '') || ' ' ||
      coalesce(${posts.excerpt}, '') || ' ' ||
      coalesce(${posts.seo}::text, '') || ' ' ||
      coalesce(${posts.layout}::text, '')
    )`;
    const query = sql`websearch_to_tsquery('english', ${term})`;
    const rows = await this.db
      .select({
        title: posts.title,
        slug: posts.slug,
        rank: sql<number>`ts_rank(to_tsvector('english', ${doc}), ${query})`,
        snippet: sql<string>`ts_headline('english', coalesce(${posts.title}, '') || ' — ' || coalesce(${posts.excerpt}, ''), ${query}, 'StartSel=<mark>,StopSel=</mark>,MaxFragments=2,MaxWords=30,MinWords=10')`,
      })
      .from(posts)
      .where(
        and(
          eq(posts.siteId, siteId),
          eq(posts.locale, locale),
          eq(posts.status, "published"),
          isNull(posts.deletedAt),
          sql`to_tsvector('english', ${doc}) @@ ${query}`,
        ),
      )
      .orderBy(sql`ts_rank(to_tsvector('english', ${doc}), ${query}) DESC`)
      .limit(max);
    return rows.map((r) => ({
      type: "post" as const,
      title: r.title,
      url: `/blog/${r.slug}`,
      snippet: r.snippet ?? "",
      rank: Number(r.rank) || 0,
    }));
  }

  private async searchCollections(
    siteId: string,
    term: string,
    max: number,
  ): Promise<SiteSearchHit[]> {
    const doc = sql`(
      coalesce(${collectionItems.slug}, '') || ' ' ||
      coalesce(${collectionItems.data}::text, '')
    )`;
    const query = sql`websearch_to_tsquery('english', ${term})`;
    const rows = await this.db
      .select({
        slug: collectionItems.slug,
        collectionSlug: collections.slug,
        rank: sql<number>`ts_rank(to_tsvector('english', ${doc}), ${query})`,
        snippet: sql<string>`ts_headline('english', coalesce(${collectionItems.slug}, '') || ' ' || left(coalesce(${collectionItems.data}::text, ''), 400), ${query}, 'StartSel=<mark>,StopSel=</mark>,MaxFragments=2,MaxWords=30,MinWords=10')`,
      })
      .from(collectionItems)
      .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
      .where(
        and(
          eq(collectionItems.siteId, siteId),
          eq(collectionItems.status, "published"),
          isNull(collectionItems.deletedAt),
          isNull(collections.deletedAt),
          sql`to_tsvector('english', ${doc}) @@ ${query}`,
        ),
      )
      .orderBy(sql`ts_rank(to_tsvector('english', ${doc}), ${query}) DESC`)
      .limit(max);
    return rows.map((r) => ({
      type: "collection" as const,
      title: r.slug,
      url: `/${r.collectionSlug}/${r.slug}`,
      snippet: r.snippet ?? "",
      rank: Number(r.rank) || 0,
    }));
  }

  /** Public path for a page slug (home has no slug segment). */
  private pageUrl(slug: string): string {
    if (!slug || slug === "home") return "/";
    return `/${slug}`;
  }
}

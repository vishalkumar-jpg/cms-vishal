import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  collectionItems,
  collections,
  media,
  pages,
  postTerms,
  posts,
} from "@database/schema";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PageQuery {
  limit?: number;
  offset?: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: { limit: number; offset: number; count: number };
}

/**
 * Read-only Content API service (E27). Returns ONLY published content for a
 * single site — the `siteId` is supplied by ContentApiKeyGuard (the key is the
 * tenant), never by a client header, so there is no cross-tenant surface. These
 * queries mirror the host-resolved PublicRenderService read paths but scope by
 * the key's site id directly (no TenantContext, since the route is @Public).
 */
@Injectable()
export class ContentApiService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private clampLimit(limit?: number): number {
    return Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
  }

  private clampOffset(offset?: number): number {
    return Math.max(0, Number(offset) || 0);
  }

  // -- pages -----------------------------------------------------------------

  async listPages(siteId: string, q: PageQuery): Promise<Paginated<Record<string, unknown>>> {
    const limit = this.clampLimit(q.limit);
    const offset = this.clampOffset(q.offset);
    const rows = await this.db
      .select({
        id: pages.id,
        slug: pages.slug,
        title: pages.title,
        seo: pages.seo,
        publishedAt: pages.publishedAt,
      })
      .from(pages)
      .where(
        and(eq(pages.siteId, siteId), eq(pages.status, "published"), isNull(pages.deletedAt)),
      )
      .orderBy(desc(pages.publishedAt))
      .limit(limit)
      .offset(offset);
    return { data: rows, pagination: { limit, offset, count: rows.length } };
  }

  async getPage(siteId: string, slug: string): Promise<Record<string, unknown>> {
    const [page] = await this.db
      .select()
      .from(pages)
      .where(
        and(
          eq(pages.siteId, siteId),
          eq(pages.slug, slug),
          eq(pages.status, "published"),
          isNull(pages.deletedAt),
        ),
      )
      .limit(1);
    if (!page || !page.publishedLayout) throw new NotFoundException("Page not found");
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      layout: page.publishedLayout,
      seo: page.seo,
      schemaVersion: page.schemaVersion,
      publishedAt: page.publishedAt,
    };
  }

  // -- posts -----------------------------------------------------------------

  async listPosts(siteId: string, q: PageQuery): Promise<Paginated<Record<string, unknown>>> {
    const limit = this.clampLimit(q.limit);
    const offset = this.clampOffset(q.offset);
    const rows = await this.db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        coverMediaId: posts.coverMediaId,
        coverUrl: media.url,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .leftJoin(media, eq(media.id, posts.coverMediaId))
      .where(
        and(eq(posts.siteId, siteId), eq(posts.status, "published"), isNull(posts.deletedAt)),
      )
      .orderBy(desc(posts.publishedAt))
      .limit(limit)
      .offset(offset);
    return { data: rows, pagination: { limit, offset, count: rows.length } };
  }

  async getPost(siteId: string, slug: string): Promise<Record<string, unknown>> {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.siteId, siteId),
          eq(posts.slug, slug),
          eq(posts.status, "published"),
          isNull(posts.deletedAt),
        ),
      )
      .limit(1);
    if (!post || !post.layout) throw new NotFoundException("Post not found");
    const terms = await this.db
      .select({ kind: postTerms.kind, name: postTerms.name, slug: postTerms.slug })
      .from(postTerms)
      .where(and(eq(postTerms.siteId, siteId), eq(postTerms.postId, post.id)));
    let coverUrl: string | null = null;
    if (post.coverMediaId) {
      const [m] = await this.db
        .select({ url: media.url })
        .from(media)
        .where(eq(media.id, post.coverMediaId))
        .limit(1);
      coverUrl = m?.url ?? null;
    }
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      layout: post.layout,
      seo: post.seo,
      coverMediaId: post.coverMediaId,
      coverUrl,
      publishedAt: post.publishedAt,
      terms,
    };
  }

  // -- collections -----------------------------------------------------------

  private async requireCollection(siteId: string, slug: string) {
    const [row] = await this.db
      .select()
      .from(collections)
      .where(
        and(eq(collections.siteId, siteId), eq(collections.slug, slug), isNull(collections.deletedAt)),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Collection not found");
    return row;
  }

  async listCollectionItems(
    siteId: string,
    collectionSlug: string,
    q: PageQuery,
  ): Promise<Paginated<Record<string, unknown>> & { collection: Record<string, unknown> }> {
    const limit = this.clampLimit(q.limit);
    const offset = this.clampOffset(q.offset);
    const collection = await this.requireCollection(siteId, collectionSlug);
    const rows = await this.db
      .select()
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.siteId, siteId),
          eq(collectionItems.collectionId, collection.id),
          eq(collectionItems.status, "published"),
          isNull(collectionItems.deletedAt),
        ),
      )
      .orderBy(desc(collectionItems.publishedAt))
      .limit(limit)
      .offset(offset);
    return {
      collection: { slug: collection.slug, name: collection.name, fields: collection.fields },
      data: rows.map((r) => this.toPublicItem(r)),
      pagination: { limit, offset, count: rows.length },
    };
  }

  async getCollectionItem(
    siteId: string,
    collectionSlug: string,
    itemSlug: string,
  ): Promise<{ collection: Record<string, unknown>; item: Record<string, unknown> }> {
    const collection = await this.requireCollection(siteId, collectionSlug);
    const [row] = await this.db
      .select()
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.siteId, siteId),
          eq(collectionItems.collectionId, collection.id),
          eq(collectionItems.slug, itemSlug),
          eq(collectionItems.status, "published"),
          isNull(collectionItems.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Item not found");
    return {
      collection: { slug: collection.slug, name: collection.name, fields: collection.fields },
      item: this.toPublicItem(row),
    };
  }

  private toPublicItem(row: typeof collectionItems.$inferSelect): Record<string, unknown> {
    return {
      id: row.id,
      slug: row.slug,
      data: row.data ?? {},
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  }

  // -- media -----------------------------------------------------------------

  async listMedia(siteId: string, q: PageQuery): Promise<Paginated<Record<string, unknown>>> {
    const limit = this.clampLimit(q.limit);
    const offset = this.clampOffset(q.offset);
    const rows = await this.db
      .select({
        id: media.id,
        url: media.url,
        type: media.type,
        alt: media.alt,
        width: media.width,
        height: media.height,
        size: media.size,
        createdAt: media.createdAt,
      })
      .from(media)
      .where(and(eq(media.siteId, siteId), eq(media.status, "ready"), isNull(media.deletedAt)))
      .orderBy(desc(media.createdAt))
      .limit(limit)
      .offset(offset);
    return { data: rows, pagination: { limit, offset, count: rows.length } };
  }
}

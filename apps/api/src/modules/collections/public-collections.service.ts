import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  collectionItems,
  collections,
  type CollectionItemRow,
  type CollectionRow,
} from "@database/schema";
import type { SerializedLayout } from "@ob-cms/block-schema";
import type { CollectionFieldDef } from "@database/schema/collections.schema";
import { RedisService } from "@modules/redis/redis.service";
import { SiteResolver } from "@modules/seo/site-resolver.service";

const RENDER_TTL_SECONDS = 300;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PublicCollectionItem {
  id: string;
  slug: string;
  data: Record<string, unknown>;
  publishedAt: string | null;
}

/** Collection metadata on list responses — no detailLayout (avoids large payloads). */
export interface PublicCollectionListMeta {
  slug: string;
  name: string;
  fields: CollectionFieldDef[];
}

/** Collection metadata on single-item responses — includes shared detailLayout. */
export interface PublicCollectionSummary extends PublicCollectionListMeta {
  /** Shared detail layout; null → generic field renderer. Additive / optional. */
  detailLayout: SerializedLayout | null;
}

export interface PublicCollectionList {
  collection: PublicCollectionListMeta;
  items: PublicCollectionItem[];
}

interface ListOpts {
  limit?: number;
  sort?: string;
  status?: string;
}

/**
 * PUBLIC collections surface (@Public, host-resolved). The site is resolved
 * SERVER-SIDE from the Host header — a client-supplied siteId is NEVER trusted.
 * Only PUBLISHED items of a collection belonging to the resolved site are served
 * (else 404, no existence leak). Reads are Redis-cached under `render:<siteId>:*`
 * so the existing publish→cache-purge sweep invalidates them.
 */
@Injectable()
export class PublicCollectionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly resolver: SiteResolver,
    private readonly redis: RedisService,
  ) {}

  /** Published items of a collection (by slug), filtered/sorted/limited. */
  async listItems(
    host: string | undefined,
    collectionSlug: string,
    opts: ListOpts,
  ): Promise<PublicCollectionList> {
    const site = await this.requireSite(host);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(opts.limit) || DEFAULT_LIMIT));
    const sort = typeof opts.sort === "string" ? opts.sort : "";
    const key = `render:${site.id}:collection:${collectionSlug}:list:${limit}:${sort}`;

    return this.cached(key, async () => {
      const collection = await this.requireCollection(site.id, collectionSlug);
      const order = this.orderBy(sort);
      const rows = await this.db
        .select()
        .from(collectionItems)
        .where(
          and(
            eq(collectionItems.siteId, site.id),
            eq(collectionItems.collectionId, collection.id),
            eq(collectionItems.status, "published"),
            isNull(collectionItems.deletedAt),
          ),
        )
        .orderBy(order)
        .limit(limit);
      return {
        collection: this.toPublicCollectionMeta(collection),
        items: rows.map((r) => this.toPublicItem(r)),
      };
    });
  }

  /** A single published item by collection slug + item slug, or 404. */
  async getItem(
    host: string | undefined,
    collectionSlug: string,
    itemSlug: string,
  ): Promise<{ collection: PublicCollectionSummary; item: PublicCollectionItem }> {
    const site = await this.requireSite(host);
    const key = `render:${site.id}:collection:${collectionSlug}:item:${itemSlug}`;
    return this.cached(key, async () => {
      const collection = await this.requireCollection(site.id, collectionSlug);
      const [row] = await this.db
        .select()
        .from(collectionItems)
        .where(
          and(
            eq(collectionItems.siteId, site.id),
            eq(collectionItems.collectionId, collection.id),
            eq(collectionItems.slug, itemSlug),
            eq(collectionItems.status, "published"),
            isNull(collectionItems.deletedAt),
          ),
        )
        .limit(1);
      if (!row) throw new NotFoundException("Item not found");
      return {
        collection: this.toPublicCollectionSummary(collection),
        item: this.toPublicItem(row),
      };
    });
  }

  // -- helpers ---------------------------------------------------------------

  private orderBy(sort: string): SQL {
    if (!sort) return desc(collectionItems.publishedAt);
    const descending = sort.startsWith("-");
    const k = (descending ? sort.slice(1) : sort).trim();
    if (k === "publishedAt") return descending ? desc(collectionItems.publishedAt) : asc(collectionItems.publishedAt);
    if (k === "createdAt") return descending ? desc(collectionItems.createdAt) : asc(collectionItems.createdAt);
    if (k === "slug") return descending ? desc(collectionItems.slug) : asc(collectionItems.slug);
    const expr = sql`${collectionItems.data}->>${k}`;
    return descending ? desc(expr) : asc(expr);
  }

  private toPublicCollectionMeta(row: CollectionRow): PublicCollectionListMeta {
    return {
      slug: row.slug,
      name: row.name,
      fields: (row.fields as CollectionFieldDef[]) ?? [],
    };
  }

  private toPublicCollectionSummary(row: CollectionRow): PublicCollectionSummary {
    return {
      ...this.toPublicCollectionMeta(row),
      detailLayout: (row.detailLayout as SerializedLayout | null) ?? null,
    };
  }

  private toPublicItem(row: CollectionItemRow): PublicCollectionItem {
    return {
      id: row.id,
      slug: row.slug,
      data: (row.data as Record<string, unknown>) ?? {},
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  }

  private async requireSite(host: string | undefined): Promise<{ id: string }> {
    const site = await this.resolver.resolve(host);
    if (!site) throw new NotFoundException("Site not found for host");
    return site;
  }

  private async requireCollection(siteId: string, slug: string): Promise<CollectionRow> {
    const [row] = await this.db
      .select()
      .from(collections)
      .where(and(eq(collections.siteId, siteId), eq(collections.slug, slug), isNull(collections.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException("Collection not found");
    return row;
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = await this.safeGet(key);
    if (hit) {
      try {
        return JSON.parse(hit) as T;
      } catch {
        /* fall through */
      }
    }
    const value = await load();
    await this.safeSet(key, JSON.stringify(value));
    return value;
  }

  private async safeGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  private async safeSet(key: string, value: string): Promise<void> {
    try {
      await this.redis.set(key, value, RENDER_TTL_SECONDS);
    } catch {
      /* ignore */
    }
  }
}

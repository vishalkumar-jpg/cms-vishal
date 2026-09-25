import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  type TemplateCatalogEntry,
  type TemplateCatalogQuery,
  type TemplateCatalogStorage,
} from "@ob-cms/template-registry";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  templateSkeletonAssets,
  templateSkeletons,
  type TemplateSkeletonAssetRow,
  type TemplateSkeletonRow,
} from "@database/schema/template-skeletons.schema";
import { toCatalogEntry } from "./template-catalog.mapper";

const LIST_LIMIT = 500; // Match TemplateSkeletonRepository hard cap until pagination lands in HTTP layer.

/** PostgreSQL read projection for template catalog browse — metadata + optional assets. */
@Injectable()
export class TemplateCatalogRepository implements TemplateCatalogStorage {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(query: TemplateCatalogQuery): Promise<TemplateCatalogEntry[]> {
    const metas = await this.db
      .select()
      .from(templateSkeletons)
      .where(and(...this.buildSkeletonFilters(query)))
      .orderBy(...this.buildSort(query.sort))
      .limit(LIST_LIMIT);

    if (metas.length === 0) return [];

    const ids = metas.map((meta) => meta.id);

    if (query.includeAssets) {
      const assetsBySkeleton = this.groupAssetsBySkeleton(await this.fetchAllAssets(ids));
      return metas
        .map((meta) =>
          toCatalogEntry(meta, {
            assets: assetsBySkeleton.get(meta.id),
            includePreviewAssets: true,
          }),
        )
        .filter((entry): entry is TemplateCatalogEntry => entry !== null);
    }

    const thumbnailAssets = await this.fetchThumbnailAssets(ids);
    const thumbnailBySkeleton = new Map(
      thumbnailAssets.map((asset) => [asset.skeletonId, asset]),
    );

    return metas
      .map((meta) => {
        const thumbnailAsset = thumbnailBySkeleton.get(meta.id);
        return toCatalogEntry(meta, {
          assets: thumbnailAsset ? [thumbnailAsset] : undefined,
          includePreviewAssets: false,
        });
      })
      .filter((entry): entry is TemplateCatalogEntry => entry !== null);
  }

  async getById(id: string): Promise<TemplateCatalogEntry | null> {
    const meta = await this.findActiveSkeleton(eq(templateSkeletons.id, id));
    if (!meta) return null;
    return this.toSingleEntry(meta);
  }

  async getByKey(templateKey: string): Promise<TemplateCatalogEntry | null> {
    const meta = await this.findActiveSkeleton(eq(templateSkeletons.templateKey, templateKey));
    if (!meta) return null;
    return this.toSingleEntry(meta);
  }

  private async toSingleEntry(meta: TemplateSkeletonRow): Promise<TemplateCatalogEntry | null> {
    const thumbnailAsset = await this.fetchThumbnailAsset(meta.id);
    return toCatalogEntry(meta, {
      assets: thumbnailAsset ? [thumbnailAsset] : undefined,
      includePreviewAssets: false,
    });
  }

  private async findActiveSkeleton(condition: SQL): Promise<TemplateSkeletonRow | null> {
    const [meta] = await this.db
      .select()
      .from(templateSkeletons)
      .where(and(condition, isNull(templateSkeletons.deletedAt)))
      .limit(1);
    return meta ?? null;
  }

  private buildSkeletonFilters(query: TemplateCatalogQuery): SQL[] {
    const conds: SQL[] = [isNull(templateSkeletons.deletedAt)];

    if (query.category) conds.push(eq(templateSkeletons.category, query.category));
    if (query.status) conds.push(eq(templateSkeletons.status, query.status));
    if (query.pageType) {
      conds.push(
        sql`${templateSkeletons.supportedPageTypes} @> ${JSON.stringify([query.pageType])}::jsonb`,
      );
    }
    if (query.tags?.length) {
      for (const tag of query.tags) {
        conds.push(sql`${templateSkeletons.tags} @> ${JSON.stringify([tag])}::jsonb`);
      }
    }
    if (query.query?.trim()) {
      const q = `%${query.query.trim()}%`;
      conds.push(
        or(
          ilike(templateSkeletons.templateKey, q),
          ilike(templateSkeletons.displayName, q),
          ilike(templateSkeletons.description, q),
        ) as SQL,
      );
    }
    if (query.featured !== undefined) {
      conds.push(
        sql`(${templateSkeletons.previewMetadata}->>'featured')::boolean = ${query.featured}`,
      );
    }

    return conds;
  }

  private buildSort(sort: TemplateCatalogQuery["sort"]): SQL[] {
    switch (sort) {
      case "updatedAt":
        return [desc(templateSkeletons.updatedAt)];
      case "featured":
        return [
          sql`(${templateSkeletons.previewMetadata}->>'featured')::boolean DESC NULLS LAST`,
          asc(templateSkeletons.displayName),
        ];
      case "displayName":
      default:
        return [asc(templateSkeletons.displayName)];
    }
  }

  private async fetchThumbnailAsset(skeletonId: string): Promise<TemplateSkeletonAssetRow | null> {
    const [row] = await this.db
      .select()
      .from(templateSkeletonAssets)
      .where(
        and(
          eq(templateSkeletonAssets.skeletonId, skeletonId),
          eq(templateSkeletonAssets.assetType, "thumbnail"),
          isNull(templateSkeletonAssets.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async fetchThumbnailAssets(
    skeletonIds: string[],
  ): Promise<TemplateSkeletonAssetRow[]> {
    if (skeletonIds.length === 0) return [];

    return this.db
      .select()
      .from(templateSkeletonAssets)
      .where(
        and(
          inArray(templateSkeletonAssets.skeletonId, skeletonIds),
          eq(templateSkeletonAssets.assetType, "thumbnail"),
          isNull(templateSkeletonAssets.deletedAt),
        ),
      );
  }

  private async fetchAllAssets(skeletonIds: string[]): Promise<TemplateSkeletonAssetRow[]> {
    if (skeletonIds.length === 0) return [];

    return this.db
      .select()
      .from(templateSkeletonAssets)
      .where(
        and(
          inArray(templateSkeletonAssets.skeletonId, skeletonIds),
          isNull(templateSkeletonAssets.deletedAt),
        ),
      )
      .orderBy(asc(templateSkeletonAssets.sortOrder), asc(templateSkeletonAssets.createdAt));
  }

  private groupAssetsBySkeleton(
    assets: TemplateSkeletonAssetRow[],
  ): Map<string, TemplateSkeletonAssetRow[]> {
    const map = new Map<string, TemplateSkeletonAssetRow[]>();
    for (const asset of assets) {
      const rows = map.get(asset.skeletonId) ?? [];
      rows.push(asset);
      map.set(asset.skeletonId, rows);
    }
    return map;
  }
}

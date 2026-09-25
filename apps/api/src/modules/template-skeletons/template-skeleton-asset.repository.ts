import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  type CreateTemplateSkeletonAssetInput,
  type TemplateSkeletonAssetRecord,
  type UpdateTemplateSkeletonAssetInput,
  TemplateSkeletonAssetStorageError,
  type TemplateSkeletonAssetStorage,
  isSingletonAssetType,
} from "@ob-cms/template-registry";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  templateSkeletonAssets,
  templateSkeletons,
  type TemplateSkeletonAssetRow,
} from "@database/schema/template-skeletons.schema";

/** PostgreSQL persistence for template skeleton preview assets — metadata references only. */
@Injectable()
export class TemplateSkeletonAssetRepository implements TemplateSkeletonAssetStorage {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(
    skeletonId: string,
    input: CreateTemplateSkeletonAssetInput,
    actorId?: string,
  ): Promise<TemplateSkeletonAssetRecord> {
    await this.requireSkeleton(skeletonId);

    if (isSingletonAssetType(input.assetType)) {
      const existing = await this.findActiveByType(skeletonId, input.assetType);
      if (existing) {
        throw new TemplateSkeletonAssetStorageError(
          `An active ${input.assetType} asset already exists for this skeleton`,
          "DUPLICATE_ASSET",
        );
      }
    }

    const [row] = await this.db
      .insert(templateSkeletonAssets)
      .values({
        skeletonId,
        assetType: input.assetType,
        storageKey: input.storageKey ?? null,
        url: input.url,
        mimeType: input.mimeType ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        size: input.size ?? null,
        altText: input.altText ?? null,
        sortOrder: input.sortOrder ?? 0,
        createdBy: actorId ?? null,
        updatedBy: actorId ?? null,
      })
      .returning();

    return this.toRecord(row);
  }

  async findById(
    skeletonId: string,
    assetId: string,
  ): Promise<TemplateSkeletonAssetRecord | null> {
    const [row] = await this.db
      .select()
      .from(templateSkeletonAssets)
      .where(
        and(
          eq(templateSkeletonAssets.id, assetId),
          eq(templateSkeletonAssets.skeletonId, skeletonId),
          isNull(templateSkeletonAssets.deletedAt),
        ),
      )
      .limit(1);
    return row ? this.toRecord(row) : null;
  }

  async listBySkeleton(skeletonId: string): Promise<TemplateSkeletonAssetRecord[]> {
    const rows = await this.db
      .select()
      .from(templateSkeletonAssets)
      .where(
        and(
          eq(templateSkeletonAssets.skeletonId, skeletonId),
          isNull(templateSkeletonAssets.deletedAt),
        ),
      )
      .orderBy(asc(templateSkeletonAssets.sortOrder), asc(templateSkeletonAssets.createdAt));

    return rows.map((row) => this.toRecord(row));
  }

  async update(
    skeletonId: string,
    assetId: string,
    input: UpdateTemplateSkeletonAssetInput,
    actorId?: string,
  ): Promise<TemplateSkeletonAssetRecord> {
    const current = await this.findById(skeletonId, assetId);
    if (!current) {
      throw new TemplateSkeletonAssetStorageError(
        `Template skeleton asset not found: ${assetId}`,
        "NOT_FOUND",
      );
    }

    const [row] = await this.db
      .update(templateSkeletonAssets)
      .set({
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.storageKey !== undefined ? { storageKey: input.storageKey } : {}),
        ...(input.mimeType !== undefined ? { mimeType: input.mimeType } : {}),
        ...(input.width !== undefined ? { width: input.width } : {}),
        ...(input.height !== undefined ? { height: input.height } : {}),
        ...(input.size !== undefined ? { size: input.size } : {}),
        ...(input.altText !== undefined ? { altText: input.altText } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        updatedBy: actorId ?? null,
      })
      .where(
        and(
          eq(templateSkeletonAssets.id, assetId),
          eq(templateSkeletonAssets.skeletonId, skeletonId),
          isNull(templateSkeletonAssets.deletedAt),
        ),
      )
      .returning();

    if (!row) {
      throw new TemplateSkeletonAssetStorageError(
        `Template skeleton asset not found: ${assetId}`,
        "NOT_FOUND",
      );
    }

    return this.toRecord(row);
  }

  async delete(skeletonId: string, assetId: string, actorId?: string): Promise<void> {
    const [row] = await this.db
      .update(templateSkeletonAssets)
      .set({ deletedAt: new Date(), updatedBy: actorId ?? null })
      .where(
        and(
          eq(templateSkeletonAssets.id, assetId),
          eq(templateSkeletonAssets.skeletonId, skeletonId),
          isNull(templateSkeletonAssets.deletedAt),
        ),
      )
      .returning({ id: templateSkeletonAssets.id });

    if (!row) {
      throw new TemplateSkeletonAssetStorageError(
        `Template skeleton asset not found: ${assetId}`,
        "NOT_FOUND",
      );
    }
  }

  private async requireSkeleton(skeletonId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: templateSkeletons.id })
      .from(templateSkeletons)
      .where(and(eq(templateSkeletons.id, skeletonId), isNull(templateSkeletons.deletedAt)))
      .limit(1);
    if (!row) {
      throw new TemplateSkeletonAssetStorageError(
        `Template skeleton not found: ${skeletonId}`,
        "SKELETON_NOT_FOUND",
      );
    }
  }

  private async findActiveByType(
    skeletonId: string,
    assetType: string,
  ): Promise<TemplateSkeletonAssetRow | null> {
    const [row] = await this.db
      .select()
      .from(templateSkeletonAssets)
      .where(
        and(
          eq(templateSkeletonAssets.skeletonId, skeletonId),
          eq(templateSkeletonAssets.assetType, assetType),
          isNull(templateSkeletonAssets.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private toRecord(row: TemplateSkeletonAssetRow): TemplateSkeletonAssetRecord {
    return {
      id: row.id,
      skeletonId: row.skeletonId,
      assetType: row.assetType as TemplateSkeletonAssetRecord["assetType"],
      storageKey: row.storageKey,
      url: row.url,
      mimeType: row.mimeType,
      width: row.width,
      height: row.height,
      size: row.size,
      altText: row.altText,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

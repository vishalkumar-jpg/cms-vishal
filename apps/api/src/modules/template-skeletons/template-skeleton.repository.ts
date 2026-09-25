import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  type CreateTemplateSkeletonInput,
  type TemplateSkeletonContent,
  type TemplateSkeletonListQuery,
  type TemplateSkeletonRecord,
  type UpdateTemplateSkeletonInput,
  TemplateSkeletonStorageError,
  type TemplateSkeletonStorage,
} from "@ob-cms/template-registry";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  templateSkeletonContents,
  templateSkeletons,
  type TemplateSkeletonContentRow,
  type TemplateSkeletonRow,
} from "@database/schema/template-skeletons.schema";
import {
  TemplateSkeletonVersionRepository,
  type TemplateSkeletonDbTx,
} from "./template-skeleton-version.repository";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

/** PostgreSQL persistence for template skeletons — no validation or business rules. */
@Injectable()
export class TemplateSkeletonRepository implements TemplateSkeletonStorage {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly versions: TemplateSkeletonVersionRepository,
  ) {}

  async create(
    input: CreateTemplateSkeletonInput,
    actorId?: string,
  ): Promise<TemplateSkeletonRecord> {
    const existing = await this.findByKey(input.templateKey);
    if (existing) {
      throw new TemplateSkeletonStorageError(
        `Template key already exists: ${input.templateKey}`,
        "DUPLICATE_KEY",
      );
    }

    return this.db.transaction(async (tx) => {
      const [meta] = await tx
        .insert(templateSkeletons)
        .values({
          templateKey: input.templateKey,
          displayName: input.displayName,
          description: input.description,
          category: input.category,
          tags: input.tags,
          supportedPageTypes: input.supportedPageTypes,
          previewMetadata: input.previewMetadata,
          version: input.version,
          status: input.status,
          schemaVersion: input.schemaVersion,
          createdBy: actorId ?? null,
          updatedBy: actorId ?? null,
        })
        .returning();

      const [contentRow] = await tx
        .insert(templateSkeletonContents)
        .values({
          skeletonId: meta.id,
          layout: input.content.layout,
          sections: input.content.sections,
          pageStructure: input.content.pageStructure,
          componentProps: input.content.componentProps,
          contentSchemaVersion: input.content.contentSchemaVersion,
          createdBy: actorId ?? null,
          updatedBy: actorId ?? null,
        })
        .returning();

      const record = this.toRecord(meta, contentRow);
      await this.versions.appendIfChangedWithTx(tx, record, actorId ?? null);
      return record;
    }).catch((err) => {
      if (isUniqueViolation(err)) {
        throw new TemplateSkeletonStorageError(
          `Template key already exists: ${input.templateKey}`,
          "DUPLICATE_KEY",
        );
      }
      throw err;
    });
  }

  async findById(id: string): Promise<TemplateSkeletonRecord | null> {
    const [meta] = await this.db
      .select()
      .from(templateSkeletons)
      .where(and(eq(templateSkeletons.id, id), isNull(templateSkeletons.deletedAt)))
      .limit(1);
    if (!meta) return null;

    const [content] = await this.db
      .select()
      .from(templateSkeletonContents)
      .where(
        and(
          eq(templateSkeletonContents.skeletonId, meta.id),
          isNull(templateSkeletonContents.deletedAt),
        ),
      )
      .limit(1);
    if (!content) return null;

    return this.toRecord(meta, content);
  }

  async findByKey(templateKey: string): Promise<TemplateSkeletonRecord | null> {
    const [meta] = await this.db
      .select()
      .from(templateSkeletons)
      .where(
        and(eq(templateSkeletons.templateKey, templateKey), isNull(templateSkeletons.deletedAt)),
      )
      .limit(1);
    if (!meta) return null;

    const [content] = await this.db
      .select()
      .from(templateSkeletonContents)
      .where(
        and(
          eq(templateSkeletonContents.skeletonId, meta.id),
          isNull(templateSkeletonContents.deletedAt),
        ),
      )
      .limit(1);
    if (!content) return null;

    return this.toRecord(meta, content);
  }

  /** Transaction-scoped lookup used by seed refresh/insert snapshot writes. */
  async findByKeyInTx(
    tx: TemplateSkeletonDbTx,
    templateKey: string,
  ): Promise<TemplateSkeletonRecord | null> {
    const [meta] = await tx
      .select()
      .from(templateSkeletons)
      .where(
        and(eq(templateSkeletons.templateKey, templateKey), isNull(templateSkeletons.deletedAt)),
      )
      .limit(1);
    if (!meta) return null;

    const [content] = await tx
      .select()
      .from(templateSkeletonContents)
      .where(
        and(
          eq(templateSkeletonContents.skeletonId, meta.id),
          isNull(templateSkeletonContents.deletedAt),
        ),
      )
      .limit(1);
    if (!content) return null;

    return this.toRecord(meta, content);
  }

  async update(
    id: string,
    input: UpdateTemplateSkeletonInput,
    actorId?: string,
  ): Promise<TemplateSkeletonRecord> {
    return this.db.transaction(async (tx) => {
      const [meta] = await tx
        .select()
        .from(templateSkeletons)
        .where(and(eq(templateSkeletons.id, id), isNull(templateSkeletons.deletedAt)))
        .limit(1)
        .for("update");

      if (!meta) {
        throw new TemplateSkeletonStorageError(`Template skeleton not found: ${id}`, "NOT_FOUND");
      }

      if (input.metadata && Object.keys(input.metadata).length > 0) {
        await tx
          .update(templateSkeletons)
          .set({
            ...(input.metadata.displayName !== undefined
              ? { displayName: input.metadata.displayName }
              : {}),
            ...(input.metadata.description !== undefined
              ? { description: input.metadata.description }
              : {}),
            ...(input.metadata.category !== undefined
              ? { category: input.metadata.category }
              : {}),
            ...(input.metadata.supportedPageTypes !== undefined
              ? { supportedPageTypes: input.metadata.supportedPageTypes }
              : {}),
            ...(input.metadata.tags !== undefined ? { tags: input.metadata.tags } : {}),
            ...(input.metadata.previewMetadata !== undefined
              ? { previewMetadata: input.metadata.previewMetadata }
              : {}),
            ...(input.metadata.version !== undefined ? { version: input.metadata.version } : {}),
            ...(input.metadata.status !== undefined ? { status: input.metadata.status } : {}),
            ...(input.metadata.schemaVersion !== undefined
              ? { schemaVersion: input.metadata.schemaVersion }
              : {}),
            updatedBy: actorId ?? null,
          })
          .where(eq(templateSkeletons.id, id));
      }

      if (input.content && Object.keys(input.content).length > 0) {
        const [contentRow] = await tx
          .select()
          .from(templateSkeletonContents)
          .where(
            and(
              eq(templateSkeletonContents.skeletonId, id),
              isNull(templateSkeletonContents.deletedAt),
            ),
          )
          .limit(1)
          .for("update");

        if (!contentRow) {
          throw new TemplateSkeletonStorageError(`Template skeleton not found: ${id}`, "NOT_FOUND");
        }

        const currentContent = this.toContent(contentRow);
        const mergedContent: TemplateSkeletonContent = {
          contentSchemaVersion:
            input.content.contentSchemaVersion ?? currentContent.contentSchemaVersion,
          layout: input.content.layout ?? currentContent.layout,
          sections: input.content.sections ?? currentContent.sections,
          pageStructure: input.content.pageStructure ?? currentContent.pageStructure,
          componentProps: input.content.componentProps ?? currentContent.componentProps,
        };

        await tx
          .update(templateSkeletonContents)
          .set({
            layout: mergedContent.layout,
            sections: mergedContent.sections,
            pageStructure: mergedContent.pageStructure,
            componentProps: mergedContent.componentProps,
            contentSchemaVersion: mergedContent.contentSchemaVersion,
            updatedBy: actorId ?? null,
          })
          .where(eq(templateSkeletonContents.skeletonId, id));
      }

      const refreshed = await this.findRecordInTx(tx, id);
      if (!refreshed) {
        throw new TemplateSkeletonStorageError(`Template skeleton not found: ${id}`, "NOT_FOUND");
      }
      await this.versions.appendIfChangedWithTx(tx, refreshed, actorId ?? null);
      return refreshed;
    });
  }

  async delete(id: string, actorId?: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      const [meta] = await tx
        .update(templateSkeletons)
        .set({ deletedAt: now, updatedBy: actorId ?? null })
        .where(and(eq(templateSkeletons.id, id), isNull(templateSkeletons.deletedAt)))
        .returning({ id: templateSkeletons.id });

      if (!meta) {
        throw new TemplateSkeletonStorageError(`Template skeleton not found: ${id}`, "NOT_FOUND");
      }

      await tx
        .update(templateSkeletonContents)
        .set({ deletedAt: now, updatedBy: actorId ?? null })
        .where(
          and(
            eq(templateSkeletonContents.skeletonId, id),
            isNull(templateSkeletonContents.deletedAt),
          ),
        );
    });
  }

  /** Hard-capped listing — pagination deferred until HTTP layer (Phase 1B-b). */
  async list(query: TemplateSkeletonListQuery): Promise<TemplateSkeletonRecord[]> {
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

    const metas = await this.db
      .select()
      .from(templateSkeletons)
      .where(and(...conds))
      .orderBy(desc(templateSkeletons.updatedAt))
      .limit(500);

    if (metas.length === 0) return [];

    const ids = metas.map((m) => m.id);
    const contents = await this.db
      .select()
      .from(templateSkeletonContents)
      .where(
        and(
          inArray(templateSkeletonContents.skeletonId, ids),
          isNull(templateSkeletonContents.deletedAt),
        ),
      );

    const contentBySkeleton = new Map(contents.map((c) => [c.skeletonId, c]));

    return metas
      .map((meta) => {
        const content = contentBySkeleton.get(meta.id);
        if (!content) return null;
        return this.toRecord(meta, content);
      })
      .filter((r): r is TemplateSkeletonRecord => r !== null);
  }

  private async findRecordInTx(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    id: string,
  ): Promise<TemplateSkeletonRecord | null> {
    const [meta] = await tx
      .select()
      .from(templateSkeletons)
      .where(and(eq(templateSkeletons.id, id), isNull(templateSkeletons.deletedAt)))
      .limit(1);
    if (!meta) return null;

    const [content] = await tx
      .select()
      .from(templateSkeletonContents)
      .where(
        and(
          eq(templateSkeletonContents.skeletonId, meta.id),
          isNull(templateSkeletonContents.deletedAt),
        ),
      )
      .limit(1);
    if (!content) return null;

    return this.toRecord(meta, content);
  }

  private toContent(row: TemplateSkeletonContentRow): TemplateSkeletonContent {
    return {
      contentSchemaVersion: row.contentSchemaVersion,
      layout: row.layout as Record<string, unknown>,
      sections: row.sections as TemplateSkeletonContent["sections"],
      pageStructure: row.pageStructure,
      componentProps: row.componentProps,
    };
  }

  private toRecord(
    meta: TemplateSkeletonRow,
    content: TemplateSkeletonContentRow,
  ): TemplateSkeletonRecord {
    return {
      metadata: {
        id: meta.id,
        templateKey: meta.templateKey,
        displayName: meta.displayName,
        description: meta.description,
        category: meta.category as TemplateSkeletonRecord["metadata"]["category"],
        supportedPageTypes: meta.supportedPageTypes,
        tags: meta.tags,
        previewMetadata: meta.previewMetadata,
        version: meta.version,
        status: meta.status as TemplateSkeletonRecord["metadata"]["status"],
        schemaVersion: meta.schemaVersion,
        createdAt: meta.createdAt.toISOString(),
        updatedAt: meta.updatedAt.toISOString(),
      },
      content: {
        contentSchemaVersion: content.contentSchemaVersion,
        layout: content.layout as Record<string, unknown>,
        sections: content.sections as TemplateSkeletonContent["sections"],
        pageStructure: content.pageStructure,
        componentProps: content.componentProps,
      },
    };
  }
}

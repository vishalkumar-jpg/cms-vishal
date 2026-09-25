import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { arrayContains, desc, eq, ilike, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { sanitizeText } from "@ob-cms/block-schema";
import {
  collectionItems,
  collections,
  media,
  mediaFolders,
  pages,
  posts,
  reusableBlocks,
  siteSettings,
  type MediaFolderRow,
  type MediaRow,
} from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import { toCsv } from "@utils/csv.utils";
import { StorageService } from "./storage.service";
import type {
  ConfirmUploadDto,
  CreateFolderDto,
  CropMediaDto,
  ListMediaQueryDto,
  MoveMediaDto,
  PresignUploadDto,
  UpdateFolderDto,
  UpdateMediaDto,
} from "./dto/media.dto";

/** One reference to a media asset found by the where-used scan. */
export interface MediaUsageRef {
  entityType: "page" | "post" | "collection-item" | "site-chrome";
  entityId: string;
  title: string;
  slug?: string;
}

export interface PresignResult {
  media: MediaRow;
  uploadUrl: string;
  storageKey: string;
}

/** Per-site media library. Binaries live in object storage; rows are the catalog. */
@Injectable()
export class MediaService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  /** Step 1: reserve a media row (status=pending) + presign a direct PUT URL. */
  async presign(dto: PresignUploadDto, actor: AuthUser): Promise<PresignResult> {
    const siteId = this.repo.siteId;
    const key = this.storage.buildKey(siteId, dto.filename);
    const [row] = await this.repo.db
      .insert(media)
      .values({
        ...this.repo.insertDefaults(),
        storageKey: key,
        url: this.storage.publicUrl(key),
        type: dto.contentType,
        size: dto.size ?? null,
        status: "pending",
        uploadedBy: actor.userId,
      })
      .returning();
    const uploadUrl = await this.storage.presignUpload(key, dto.contentType);
    await this.recordAudit(actor, "media.presigned", row.id, { type: dto.contentType });
    return { media: row, uploadUrl, storageKey: key };
  }

  /**
   * Import pipeline upload: write bytes server-side and create a processing media row.
   * Used by HubSpot asset migration (J1) — not the browser presign flow.
   */
  async importFromBytes(
    input: {
      filename: string;
      contentType: string;
      body: Buffer;
      alt?: string;
      byteSize: number;
    },
    actor: AuthUser,
  ): Promise<MediaRow> {
    const siteId = this.repo.siteId;
    const key = this.storage.buildKey(siteId, input.filename);
    await this.storage.putObject(key, input.body, input.contentType);
    const url = this.storage.publicUrl(key);
    let row: MediaRow;
    try {
      [row] = await this.repo.db
        .insert(media)
        .values({
          ...this.repo.insertDefaults(),
          storageKey: key,
          url,
          type: input.contentType,
          alt: input.alt ? sanitizeText(input.alt) : null,
          size: input.byteSize,
          status: "processing",
          uploadedBy: actor.userId,
        })
        .returning();
    } catch (dbErr) {
      try {
        await this.storage.delete(key);
      } catch (cleanupErr) {
        const original =
          dbErr instanceof Error ? dbErr.message : "Media database insert failed.";
        const cleanup =
          cleanupErr instanceof Error ? cleanupErr.message : "Storage cleanup failed.";
        throw new Error(`${original} (storage cleanup also failed: ${cleanup})`);
      }
      throw dbErr;
    }

    try {
      await this.queue.enqueueMediaProcess({
        siteId,
        mediaId: row.id,
        storageKey: row.storageKey,
      });
    } catch {
      /* Keep a durable reconciliation marker without failing the import upload path. */
      try {
        await this.repo.db
          .update(media)
          .set({ status: "failed", updatedBy: actor.userId })
          .where(this.repo.scope(media, eq(media.id, row.id)));
        row = { ...row, status: "failed", updatedBy: actor.userId };
      } catch {
        /* The inserted processing row remains visible for reconciliation. */
      }
    }

    try {
      await this.recordAudit(actor, "media.uploaded", row.id, { source: "import" });
    } catch {
      /* Audit failures must not fail the import upload path. */
    }

    return row;
  }

  /** Step 2: mark uploaded (status=ready) and enqueue the image-processing job. */
  async confirm(dto: ConfirmUploadDto, actor: AuthUser): Promise<MediaRow> {
    const existing = await this.get(dto.mediaId);
    const [row] = await this.repo.db
      .update(media)
      .set({
        status: "ready",
        size: dto.size ?? existing.size,
        width: dto.width ?? existing.width,
        height: dto.height ?? existing.height,
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(media, eq(media.id, dto.mediaId)))
      .returning();
    await this.queue.enqueueMediaProcess({
      siteId: this.repo.siteId,
      mediaId: row.id,
      storageKey: row.storageKey,
    });
    await this.recordAudit(actor, "media.uploaded", row.id);
    return row;
  }

  async list(query: ListMediaQueryDto): Promise<MediaRow[]> {
    const extra: Array<SQL | undefined> = [];
    if (query.type) extra.push(ilike(media.type, `${query.type}%`));
    if (query.q) extra.push(ilike(media.alt, `%${query.q}%`));
    if (query.tag) extra.push(arrayContains(media.tags, [query.tag]));
    // folderId omitted → all; "root" → unfiled; otherwise that folder.
    if (query.folderId === "root") extra.push(isNull(media.folderId));
    else if (query.folderId) extra.push(eq(media.folderId, query.folderId));
    return this.repo.db
      .select()
      .from(media)
      .where(this.repo.scope(media, ...extra))
      .orderBy(desc(media.createdAt))
      .limit(500);
  }

  async get(id: string): Promise<MediaRow> {
    const [row] = await this.repo.db
      .select()
      .from(media)
      .where(this.repo.scope(media, eq(media.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Media not found");
    return row;
  }

  async update(id: string, dto: UpdateMediaDto, actor: AuthUser): Promise<MediaRow> {
    await this.get(id);
    const patch: Partial<MediaRow> = { updatedBy: actor.userId };
    if (dto.alt !== undefined) patch.alt = sanitizeText(dto.alt);
    if (dto.tags !== undefined) patch.tags = dto.tags.map((t) => sanitizeText(t)).filter(Boolean);
    if (dto.focalPoint !== undefined) patch.focalPoint = { x: dto.focalPoint.x, y: dto.focalPoint.y };
    if (dto.folderId !== undefined) {
      if (dto.folderId) await this.getFolder(dto.folderId); // validate (scoped)
      patch.folderId = dto.folderId ?? null;
    }
    const [row] = await this.repo.db
      .update(media)
      .set(patch)
      .where(this.repo.scope(media, eq(media.id, id)))
      .returning();
    await this.recordAudit(actor, "media.updated", id, { fields: Object.keys(dto) });
    return row;
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const existing = await this.get(id);
    await this.repo.db
      .update(media)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(media, eq(media.id, id)));
    // Best-effort blob delete; row is already soft-deleted (and scoped out).
    try {
      await this.storage.delete(existing.storageKey);
    } catch {
      // Worker/lifecycle policy can reap orphaned blobs.
    }
    await this.recordAudit(actor, "media.deleted", id);
    return { ok: true };
  }

  /** Formula-injection-safe CSV export of the library. */
  async exportCsv(): Promise<string> {
    const rows = await this.repo.db
      .select()
      .from(media)
      .where(this.repo.scope(media))
      .orderBy(desc(media.createdAt))
      .limit(5000);
    return toCsv(
      ["id", "type", "alt", "tags", "size", "width", "height", "url", "createdAt"],
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        alt: r.alt ?? "",
        tags: (r.tags ?? []).join(" "),
        size: r.size ?? "",
        width: r.width ?? "",
        height: r.height ?? "",
        url: r.url ?? "",
        createdAt: r.createdAt.toISOString(),
      })),
    );
  }

  // --- Crop / focal point ----------------------------------------------------

  /**
   * Request a server-side crop. Stores the crop params on the row immediately
   * (so the editor is responsive) and enqueues the worker to actually produce
   * the cropped derivative + re-derive variants (when sharp is available).
   */
  async crop(id: string, dto: CropMediaDto, actor: AuthUser): Promise<MediaRow> {
    const existing = await this.get(id);
    if (!existing.type.startsWith("image/")) {
      throw new BadRequestException("Crop is only supported for images");
    }
    const cropRect = { x: dto.x, y: dto.y, w: dto.w, h: dto.h };
    const [row] = await this.repo.db
      .update(media)
      .set({ cropRect, status: "processing", updatedBy: actor.userId })
      .where(this.repo.scope(media, eq(media.id, id)))
      .returning();
    await this.queue.enqueueMediaCrop({
      siteId: this.repo.siteId,
      mediaId: row.id,
      storageKey: row.storageKey,
      crop: cropRect,
    });
    await this.recordAudit(actor, "media.cropped", id, cropRect);
    return row;
  }

  // --- Folders ----------------------------------------------------------------

  async listFolders(): Promise<MediaFolderRow[]> {
    return this.repo.db
      .select()
      .from(mediaFolders)
      .where(this.repo.scope(mediaFolders))
      .orderBy(mediaFolders.name);
  }

  async getFolder(id: string): Promise<MediaFolderRow> {
    const [row] = await this.repo.db
      .select()
      .from(mediaFolders)
      .where(this.repo.scope(mediaFolders, eq(mediaFolders.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Folder not found");
    return row;
  }

  async createFolder(dto: CreateFolderDto, actor: AuthUser): Promise<MediaFolderRow> {
    if (dto.parentId) await this.getFolder(dto.parentId); // validate parent is in-tenant
    const [row] = await this.repo.db
      .insert(mediaFolders)
      .values({
        ...this.repo.insertDefaults(),
        name: sanitizeText(dto.name),
        parentId: dto.parentId ?? null,
      })
      .returning();
    await this.recordAudit(actor, "media.folder_created", row.id, { name: row.name });
    return row;
  }

  async updateFolder(id: string, dto: UpdateFolderDto, actor: AuthUser): Promise<MediaFolderRow> {
    await this.getFolder(id);
    const patch: Partial<MediaFolderRow> = { updatedBy: actor.userId };
    if (dto.name !== undefined) patch.name = sanitizeText(dto.name);
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) throw new BadRequestException("A folder cannot be its own parent");
      if (dto.parentId) await this.getFolder(dto.parentId);
      patch.parentId = dto.parentId ?? null;
    }
    const [row] = await this.repo.db
      .update(mediaFolders)
      .set(patch)
      .where(this.repo.scope(mediaFolders, eq(mediaFolders.id, id)))
      .returning();
    await this.recordAudit(actor, "media.folder_updated", id, { fields: Object.keys(dto) });
    return row;
  }

  /**
   * Delete a folder. Children folders are re-parented to this folder's parent
   * and assets are moved to root, so nothing is orphaned (soft-delete the row).
   */
  async deleteFolder(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const folder = await this.getFolder(id);
    await this.repo.db
      .update(mediaFolders)
      .set({ parentId: folder.parentId, updatedBy: actor.userId })
      .where(this.repo.scope(mediaFolders, eq(mediaFolders.parentId, id)));
    await this.repo.db
      .update(media)
      .set({ folderId: null, updatedBy: actor.userId })
      .where(this.repo.scope(media, eq(media.folderId, id)));
    await this.repo.db
      .update(mediaFolders)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(mediaFolders, eq(mediaFolders.id, id)));
    await this.recordAudit(actor, "media.folder_deleted", id);
    return { ok: true };
  }

  /** Move a set of assets into a folder (null = root). */
  async move(dto: MoveMediaDto, actor: AuthUser): Promise<{ moved: number }> {
    if (dto.mediaIds.length === 0) return { moved: 0 };
    if (dto.folderId) await this.getFolder(dto.folderId);
    const result = await this.repo.db
      .update(media)
      .set({ folderId: dto.folderId ?? null, updatedBy: actor.userId })
      .where(this.repo.scope(media, inArray(media.id, dto.mediaIds)))
      .returning({ id: media.id });
    await this.recordAudit(actor, "media.moved", dto.folderId ?? "root", {
      count: result.length,
    });
    return { moved: result.length };
  }

  // --- Where-used / usage tracking -------------------------------------------

  /**
   * Read-only scan for everything referencing this asset. We match BOTH the
   * media id and its public URL inside the jsonb layouts of pages, posts,
   * collection items, reusable blocks and the site chrome (header/footer). The
   * match is a containment text-search on the serialized jsonb (`::text ILIKE`)
   * — cheap, index-free, and correct for "is this asset used anywhere".
   */
  async usage(id: string): Promise<MediaUsageRef[]> {
    const asset = await this.get(id);
    const needles = [id, asset.url].filter((v): v is string => Boolean(v));
    const refs: MediaUsageRef[] = [];

    // pages — scan both draft + published layouts + seo (ogImage).
    const pageRows = await this.repo.db
      .select({ id: pages.id, title: pages.title, slug: pages.slug })
      .from(pages)
      .where(this.repo.scope(pages, this.jsonbMatches([pages.draftLayout, pages.publishedLayout, pages.seo], needles)))
      .limit(500);
    for (const r of pageRows) refs.push({ entityType: "page", entityId: r.id, title: r.title, slug: r.slug });

    // posts — layout + seo + coverMediaId.
    const postRows = await this.repo.db
      .select({ id: posts.id, title: posts.title, slug: posts.slug })
      .from(posts)
      .where(
        this.repo.scope(
          posts,
          sql`(${this.jsonbMatches([posts.layout, posts.seo], needles)} OR ${posts.coverMediaId} = ${id})`,
        ),
      )
      .limit(500);
    for (const r of postRows) refs.push({ entityType: "post", entityId: r.id, title: r.title, slug: r.slug });

    // collection items — free-form data jsonb (image fields).
    const itemRows = await this.repo.db
      .select({ id: collectionItems.id, slug: collectionItems.slug, name: collections.name })
      .from(collectionItems)
      .innerJoin(collections, eq(collectionItems.collectionId, collections.id))
      .where(this.repo.scope(collectionItems, this.jsonbMatches([collectionItems.data], needles)))
      .limit(500);
    for (const r of itemRows)
      refs.push({ entityType: "collection-item", entityId: r.id, title: `${r.name}: ${r.slug}`, slug: r.slug });

    // reusable blocks — a hit means it's used everywhere the block is placed.
    const blockRows = await this.repo.db
      .select({ id: reusableBlocks.id, name: reusableBlocks.name })
      .from(reusableBlocks)
      .where(this.repo.scope(reusableBlocks, this.jsonbMatches([reusableBlocks.layout], needles)))
      .limit(500);
    for (const r of blockRows)
      refs.push({ entityType: "page", entityId: r.id, title: `Reusable block: ${r.name}` });

    // site chrome (header/footer) + branding image urls.
    const [settings] = await this.repo.db
      .select({
        id: siteSettings.id,
        headerLayout: siteSettings.headerLayout,
        footerLayout: siteSettings.footerLayout,
        logoUrl: siteSettings.logoUrl,
        faviconUrl: siteSettings.faviconUrl,
        defaultOgImageUrl: siteSettings.defaultOgImageUrl,
      })
      .from(siteSettings)
      .where(this.repo.scope(siteSettings))
      .limit(1);
    if (settings) {
      const blob = JSON.stringify([
        settings.headerLayout,
        settings.footerLayout,
        settings.logoUrl,
        settings.faviconUrl,
        settings.defaultOgImageUrl,
      ]);
      if (needles.some((n) => blob.includes(n)))
        refs.push({ entityType: "site-chrome", entityId: settings.id, title: "Site chrome / branding" });
    }

    return refs;
  }

  /** OR-of (column::text ILIKE %needle%) across columns × needles. */
  private jsonbMatches(columns: unknown[], needles: string[]): SQL {
    const clauses: SQL[] = [];
    for (const col of columns) {
      for (const needle of needles) {
        clauses.push(sql`${col}::text ILIKE ${"%" + needle + "%"}`);
      }
    }
    if (clauses.length === 0) return sql`false`;
    // Parenthesize the OR group — `scope()` ANDs this into the tenant predicate,
    // and AND binds tighter than OR, so the group MUST be wrapped.
    const ored = clauses.reduce((acc, c) => sql`${acc} OR ${c}`);
    return sql`(${ored})`;
  }

  private async recordAudit(
    actor: AuthUser,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action,
      category: "content",
      entityType: "media",
      entityId,
      metadata,
    });
  }
}

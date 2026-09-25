import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  deserializeLayout,
  sanitizeText,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import {
  collectionItems,
  collections,
  type CollectionItemRow,
  type CollectionRow,
} from "@database/schema";
import type { CollectionFieldDef } from "@database/schema/collections.schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import type {
  CollectionFieldDto,
  CreateCollectionDto,
  CreateCollectionItemDto,
  ListItemsQueryDto,
  UpdateCollectionDto,
  UpdateCollectionDetailLayoutDto,
  UpdateCollectionItemDto,
} from "./dto/collection.dto";

export interface ListItemsResult {
  items: CollectionItemRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Collections service (dynamic content types). Collections define a per-site
 * field schema; items are rows whose `data` jsonb is keyed by field keys, with a
 * draft/published lifecycle. All reads/writes go through the ScopedRepository so
 * everything is hard-scoped to the active tenant (X-Site-Id). Publishing an item
 * purges the site's render cache so the public list/detail re-resolves.
 */
@Injectable()
export class CollectionsService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  // -- collections -----------------------------------------------------------

  async list(): Promise<CollectionRow[]> {
    return this.repo.db
      .select()
      .from(collections)
      .where(this.repo.scope(collections))
      .orderBy(desc(collections.updatedAt))
      .limit(500);
  }

  async get(id: string): Promise<CollectionRow> {
    const [row] = await this.repo.db
      .select()
      .from(collections)
      .where(this.repo.scope(collections, eq(collections.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Collection not found");
    return row;
  }

  async create(dto: CreateCollectionDto, actor: AuthUser): Promise<CollectionRow> {
    const name = sanitizeText(dto.name);
    await this.assertSlugFree(dto.slug);
    await this.assertNameFree(name);
    const detailLayout =
      dto.detailLayout == null ? null : this.validateDetailLayout(dto.detailLayout);
    const [row] = await this.repo.db
      .insert(collections)
      .values({
        ...this.repo.insertDefaults(),
        name,
        slug: dto.slug,
        fields: this.sanitizeFields(dto.fields),
        detailLayout,
      })
      .returning();
    await this.recordAudit(actor, "collection.created", row.id, { name, slug: dto.slug });
    return row;
  }

  async update(id: string, dto: UpdateCollectionDto, actor: AuthUser): Promise<CollectionRow> {
    const existing = await this.get(id);
    const patch: Partial<typeof collections.$inferInsert> = { updatedBy: actor.userId };
    if (dto.name !== undefined) {
      const name = sanitizeText(dto.name);
      if (name !== existing.name) await this.assertNameFree(name, id);
      patch.name = name;
    }
    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      await this.assertSlugFree(dto.slug, id);
      patch.slug = dto.slug;
    }
    if (dto.fields !== undefined) patch.fields = this.sanitizeFields(dto.fields);
    if (dto.detailLayout !== undefined) {
      patch.detailLayout =
        dto.detailLayout === null ? null : this.validateDetailLayout(dto.detailLayout);
    }
    const [row] = await this.repo.db
      .update(collections)
      .set(patch)
      .where(this.repo.scope(collections, eq(collections.id, id)))
      .returning();
    await this.recordAudit(actor, "collection.updated", id, { fields: Object.keys(dto) });
    await this.purge(row.slug);
    return row;
  }

  /** Autosave the shared detail layout only — does not touch name/slug/fields. */
  async saveDetailLayout(
    id: string,
    dto: UpdateCollectionDetailLayoutDto,
    actor: AuthUser,
  ): Promise<CollectionRow> {
    await this.get(id);
    if (dto.detailLayout === undefined) {
      throw new BadRequestException("detailLayout is required");
    }
    const detailLayout =
      dto.detailLayout === null ? null : this.validateDetailLayout(dto.detailLayout);
    const [row] = await this.repo.db
      .update(collections)
      .set({ detailLayout, updatedBy: actor.userId })
      .where(this.repo.scope(collections, eq(collections.id, id)))
      .returning();
    if (!row) throw new NotFoundException("Collection not found");
    await this.recordAudit(actor, "collection.detail_layout_saved", id);
    await this.purge(row.slug);
    return row;
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const existing = await this.get(id);
    await this.repo.db
      .update(collections)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(collections, eq(collections.id, id)));
    await this.recordAudit(actor, "collection.deleted", id);
    await this.purge(existing.slug);
    return { ok: true };
  }

  // -- items -----------------------------------------------------------------

  async listItems(collectionId: string, query: ListItemsQueryDto): Promise<ListItemsResult> {
    await this.get(collectionId); // ensures collection exists + is in-tenant
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));

    const conds = [eq(collectionItems.collectionId, collectionId)];
    if (query.status === "draft" || query.status === "published") {
      conds.push(eq(collectionItems.status, query.status));
    }
    const where = this.repo.scope(collectionItems, and(...conds));

    const order = this.itemOrderBy(query.sort);
    const [{ count }] = await this.repo.db
      .select({ count: sql<number>`count(*)::int` })
      .from(collectionItems)
      .where(where);

    const items = await this.repo.db
      .select()
      .from(collectionItems)
      .where(where)
      .orderBy(order)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { items, total: Number(count) || 0, page, pageSize };
  }

  async getItem(collectionId: string, itemId: string): Promise<CollectionItemRow> {
    await this.get(collectionId);
    const [row] = await this.repo.db
      .select()
      .from(collectionItems)
      .where(
        this.repo.scope(
          collectionItems,
          and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.id, itemId)),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Item not found");
    return row;
  }

  async createItem(
    collectionId: string,
    dto: CreateCollectionItemDto,
    actor: AuthUser,
  ): Promise<CollectionItemRow> {
    const collection = await this.get(collectionId);
    await this.assertItemSlugFree(collectionId, dto.slug);
    const data = this.sanitizeData(collection.fields, dto.data ?? {});
    const [row] = await this.repo.db
      .insert(collectionItems)
      .values({
        ...this.repo.insertDefaults(),
        collectionId,
        slug: dto.slug,
        data,
        status: "draft",
      })
      .returning();
    await this.recordAudit(actor, "collection_item.created", row.id, {
      collectionId,
      slug: dto.slug,
    });
    return row;
  }

  async updateItem(
    collectionId: string,
    itemId: string,
    dto: UpdateCollectionItemDto,
    actor: AuthUser,
  ): Promise<CollectionItemRow> {
    const collection = await this.get(collectionId);
    const existing = await this.getItem(collectionId, itemId);
    const patch: Partial<typeof collectionItems.$inferInsert> = { updatedBy: actor.userId };
    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      await this.assertItemSlugFree(collectionId, dto.slug, itemId);
      patch.slug = dto.slug;
    }
    if (dto.data !== undefined) patch.data = this.sanitizeData(collection.fields, dto.data);
    const [row] = await this.repo.db
      .update(collectionItems)
      .set(patch)
      .where(this.repo.scope(collectionItems, eq(collectionItems.id, itemId)))
      .returning();
    await this.recordAudit(actor, "collection_item.updated", itemId, { collectionId });
    if (row.status === "published") await this.purge(collection.slug);
    return row;
  }

  async publishItem(
    collectionId: string,
    itemId: string,
    actor: AuthUser,
  ): Promise<CollectionItemRow> {
    const collection = await this.get(collectionId);
    await this.getItem(collectionId, itemId);
    const [row] = await this.repo.db
      .update(collectionItems)
      .set({ status: "published", publishedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(collectionItems, eq(collectionItems.id, itemId)))
      .returning();
    await this.recordAudit(actor, "collection_item.published", itemId, { collectionId });
    await this.purge(collection.slug);
    return row;
  }

  async unpublishItem(
    collectionId: string,
    itemId: string,
    actor: AuthUser,
  ): Promise<CollectionItemRow> {
    const collection = await this.get(collectionId);
    await this.getItem(collectionId, itemId);
    const [row] = await this.repo.db
      .update(collectionItems)
      .set({ status: "draft", publishedAt: null, updatedBy: actor.userId })
      .where(this.repo.scope(collectionItems, eq(collectionItems.id, itemId)))
      .returning();
    await this.recordAudit(actor, "collection_item.unpublished", itemId, { collectionId });
    await this.purge(collection.slug);
    return row;
  }

  async removeItem(
    collectionId: string,
    itemId: string,
    actor: AuthUser,
  ): Promise<{ ok: true }> {
    const collection = await this.get(collectionId);
    const existing = await this.getItem(collectionId, itemId);
    await this.repo.db
      .update(collectionItems)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(collectionItems, eq(collectionItems.id, itemId)));
    await this.recordAudit(actor, "collection_item.deleted", itemId, { collectionId });
    if (existing.status === "published") await this.purge(collection.slug);
    return { ok: true };
  }

  // -- helpers ---------------------------------------------------------------

  private itemOrderBy(sort?: string): SQL {
    if (!sort) return desc(collectionItems.updatedAt);
    const descending = sort.startsWith("-");
    const key = (descending ? sort.slice(1) : sort).trim();
    if (key === "createdAt") return descending ? desc(collectionItems.createdAt) : asc(collectionItems.createdAt);
    if (key === "updatedAt") return descending ? desc(collectionItems.updatedAt) : asc(collectionItems.updatedAt);
    if (key === "slug") return descending ? desc(collectionItems.slug) : asc(collectionItems.slug);
    // Sort by a data field key (jsonb ->> text comparison).
    const expr = sql`${collectionItems.data}->>${key}`;
    return descending ? desc(expr) : asc(expr);
  }

  private async assertSlugFree(slug: string, excludeId?: string): Promise<void> {
    const [row] = await this.repo.db
      .select({ id: collections.id })
      .from(collections)
      .where(this.repo.scope(collections, eq(collections.slug, slug)))
      .limit(1);
    if (row && row.id !== excludeId) {
      throw new ConflictException("A collection with this slug already exists");
    }
  }

  private async assertNameFree(name: string, excludeId?: string): Promise<void> {
    const [row] = await this.repo.db
      .select({ id: collections.id })
      .from(collections)
      .where(this.repo.scope(collections, eq(collections.name, name)))
      .limit(1);
    if (row && row.id !== excludeId) {
      throw new ConflictException("A collection with this name already exists");
    }
  }

  private async assertItemSlugFree(
    collectionId: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const [row] = await this.repo.db
      .select({ id: collectionItems.id })
      .from(collectionItems)
      .where(
        this.repo.scope(
          collectionItems,
          and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.slug, slug)),
        ),
      )
      .limit(1);
    if (row && row.id !== excludeId) {
      throw new ConflictException("An item with this slug already exists");
    }
  }

  /**
   * Validate + repair a detail layout through block-schema (same contract as
   * pages.draftLayout). Throws 400 when deserialize/repair fails.
   */
  private validateDetailLayout(input: Record<string, unknown>): SerializedLayout {
    try {
      return deserializeLayout(JSON.stringify(input));
    } catch (err) {
      throw new BadRequestException(`Invalid detailLayout: ${(err as Error).message}`);
    }
  }

  /** Validate/dedupe the field schema. Throws on duplicate keys. */
  private sanitizeFields(fields?: CollectionFieldDto[]): CollectionFieldDef[] {
    if (!fields) return [];
    const seen = new Set<string>();
    return fields.map((f) => {
      if (seen.has(f.key)) throw new BadRequestException(`Duplicate field key: ${f.key}`);
      seen.add(f.key);
      return {
        key: f.key,
        label: sanitizeText(f.label),
        type: f.type,
        required: f.required ?? false,
      } satisfies CollectionFieldDef;
    });
  }

  /**
   * Project the incoming data bag onto ONLY the collection's known field keys,
   * coercing per declared type. Unknown keys are dropped (never persisted).
   */
  private sanitizeData(
    fields: CollectionFieldDef[],
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = data[field.key];
      if (raw === undefined || raw === null) continue;
      out[field.key] = this.coerce(field, raw);
    }
    return out;
  }

  private coerce(field: CollectionFieldDef, raw: unknown): unknown {
    switch (field.type) {
      case "number": {
        const n = typeof raw === "number" ? raw : Number(raw);
        return Number.isFinite(n) ? n : null;
      }
      case "boolean":
        return raw === true || raw === "true" || raw === 1 || raw === "1";
      case "richtext":
        // Richtext keeps markup; the renderer sanitizes on output.
        return typeof raw === "string" ? raw.slice(0, 20000) : String(raw);
      case "text":
      case "image":
      case "date":
      case "reference":
      default:
        return typeof raw === "string" ? sanitizeText(raw).slice(0, 5000) : sanitizeText(String(raw));
    }
  }

  private async purge(collectionSlug: string): Promise<void> {
    await this.queue.enqueueCachePurge({
      siteId: this.repo.siteId,
      entity: "collection",
      entityId: collectionSlug,
      slug: "/",
    });
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
      entityType: action.startsWith("collection_item") ? "collection_item" : "collection",
      entityId,
      metadata,
    });
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq, isNull } from "drizzle-orm";
import {
  deserializeLayout,
  migrate,
  scrubReusableBlockReferences,
  type ComponentProp,
  type ComponentVariant,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import { pages, reusableBlocks, siteSettings, type ReusableBlockRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import type {
  CreateReusableBlockDto,
  UpdateReusableBlockDto,
} from "./dto/reusable-blocks.dto";

export interface ReusableBlockSummary {
  id: string;
  name: string;
  layout: SerializedLayout;
  /** COMPONENTS: declared editable props (null/[] for a plain reusable block). */
  props: ComponentProp[];
  /** COMPONENTS: named prop-preset variants (null/[] for a plain reusable block). */
  variants: ComponentVariant[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * REUSE-BLOCKS service — named, per-site reusable blocks that pages REFERENCE
 * (not copy). Editing a block updates EVERY instance. All reads/writes go
 * through the ScopedRepository so blocks can only ever be touched within the
 * active tenant (X-Site-Id). Layouts are validated/repaired through
 * @ob-cms/block-schema before they hit the DB.
 *
 * MVP: save = live. On create/update we enqueue a cache-purge of the site's
 * render keys so every instance re-resolves after revalidate ("edit once,
 * update everywhere").
 */
@Injectable()
export class ReusableBlocksService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  /** List the active site's reusable blocks (newest first). */
  async list(): Promise<ReusableBlockSummary[]> {
    const rows = await this.repo.db
      .select()
      .from(reusableBlocks)
      .where(this.repo.scope(reusableBlocks))
      .orderBy(desc(reusableBlocks.updatedAt));
    return rows.map((r) => this.toSummary(r));
  }

  /** One reusable block by id (scoped to the active site), or 404. */
  async get(id: string): Promise<ReusableBlockSummary> {
    return this.toSummary(await this.require(id));
  }

  /** Create a reusable block from a serialized fragment. */
  async create(dto: CreateReusableBlockDto, actor: AuthUser): Promise<ReusableBlockSummary> {
    const layout = this.validateLayout(dto.layout);
    const [row] = await this.repo.db
      .insert(reusableBlocks)
      .values({
        ...this.repo.insertDefaults(),
        name: dto.name.trim(),
        layout,
        props: dto.props ?? null,
        variants: dto.variants ?? null,
      })
      .returning();

    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "reusable_block.created",
      category: "content",
      entityType: "reusable_block",
      entityId: row.id,
      metadata: { name: row.name },
    });

    return this.toSummary(row);
  }

  /**
   * Update name and/or layout. A provided layout is validated. Triggers a render
   * cache-purge so every `ReusableBlock` instance re-resolves the new source.
   */
  async update(
    id: string,
    dto: UpdateReusableBlockDto,
    actor: AuthUser,
  ): Promise<ReusableBlockSummary> {
    await this.require(id);

    const patch: Partial<typeof reusableBlocks.$inferInsert> = { updatedBy: actor.userId };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.layout !== undefined) patch.layout = this.validateLayout(dto.layout);
    if (dto.props !== undefined) patch.props = dto.props;
    if (dto.variants !== undefined) patch.variants = dto.variants;

    const [row] = await this.repo.db
      .update(reusableBlocks)
      .set(patch)
      .where(this.repo.scope(reusableBlocks, eq(reusableBlocks.id, id)))
      .returning();

    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "reusable_block.updated",
      category: "content",
      entityType: "reusable_block",
      entityId: row.id,
      metadata: { name: row.name },
    });

    // MVP save = live: purge the render keys so every instance re-resolves.
    await this.queue.enqueueCachePurge({
      siteId: this.repo.siteId,
      entity: "reusable-block",
      entityId: row.id,
      slug: "/",
    });

    return this.toSummary(row);
  }

  /** Soft-delete a reusable block and scrub stale references from layouts. */
  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    await this.require(id);
    await this.repo.db
      .update(reusableBlocks)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(reusableBlocks, eq(reusableBlocks.id, id)));

    await this.scrubReferences(id, actor.userId);

    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "reusable_block.deleted",
      category: "content",
      entityType: "reusable_block",
      entityId: id,
    });

    await this.queue.enqueueCachePurge({
      siteId: this.repo.siteId,
      entity: "reusable-block",
      entityId: id,
      slug: "/",
    });

    return { ok: true };
  }

  // -- helpers ---------------------------------------------------------------

  /** Drop deleted-block references from global chrome + page layouts. */
  private async scrubReferences(deletedId: string, actorId: string): Promise<void> {
    const siteId = this.repo.siteId;

    const [settings] = await this.repo.db
      .select()
      .from(siteSettings)
      .where(this.repo.scope(siteSettings))
      .limit(1);
    if (settings) {
      const headerLayout = scrubReusableBlockReferences(
        settings.headerLayout as SerializedLayout | null,
        deletedId,
      );
      const footerLayout = scrubReusableBlockReferences(
        settings.footerLayout as SerializedLayout | null,
        deletedId,
      );
      if (headerLayout !== settings.headerLayout || footerLayout !== settings.footerLayout) {
        await this.repo.db
          .update(siteSettings)
          .set({
            headerLayout,
            footerLayout,
            updatedBy: actorId,
          })
          .where(this.repo.scope(siteSettings, eq(siteSettings.id, settings.id)));
      }
    }

    const pageRows = await this.repo.db
      .select({
        id: pages.id,
        draftLayout: pages.draftLayout,
        publishedLayout: pages.publishedLayout,
      })
      .from(pages)
      .where(this.repo.scope(pages, isNull(pages.deletedAt)));

    for (const page of pageRows) {
      const draftLayout = scrubReusableBlockReferences(
        page.draftLayout as SerializedLayout | null,
        deletedId,
      );
      const publishedLayout = scrubReusableBlockReferences(
        page.publishedLayout as SerializedLayout | null,
        deletedId,
      );
      if (draftLayout === page.draftLayout && publishedLayout === page.publishedLayout) continue;
      await this.repo.db
        .update(pages)
        .set({
          draftLayout: draftLayout as unknown,
          publishedLayout: publishedLayout as unknown,
          updatedBy: actorId,
        })
        .where(this.repo.scope(pages, eq(pages.id, page.id)));
    }
  }

  private async require(id: string): Promise<ReusableBlockRow> {
    const [row] = await this.repo.db
      .select()
      .from(reusableBlocks)
      .where(this.repo.scope(reusableBlocks, eq(reusableBlocks.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Reusable block not found");
    return row;
  }

  private toSummary(row: ReusableBlockRow): ReusableBlockSummary {
    return {
      id: row.id,
      name: row.name,
      layout: migrate(row.layout as SerializedLayout),
      props: (row.props as ComponentProp[] | null) ?? [],
      variants: (row.variants as ComponentVariant[] | null) ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** Validate + repair a layout through block-schema. Throws 400 on garbage. */
  private validateLayout(input: SerializedLayout): SerializedLayout {
    try {
      return deserializeLayout(JSON.stringify(input));
    } catch (err) {
      throw new BadRequestException(`Invalid layout: ${(err as Error).message}`);
    }
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  deserializeLayout,
  scrubReusableBlockReferences,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import { reusableBlocks, siteSettings } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import type { UpdateSiteChromeDto } from "./dto/site-chrome.dto";

export interface SiteChrome {
  header: SerializedLayout | null;
  footer: SerializedLayout | null;
}

/**
 * Site chrome (GLOBAL-CHROME) — ONE header + ONE footer SerializedLayout per
 * site, stored on the `site_settings` singleton and applied by the renderer
 * around EVERY page. Reads/writes go through the ScopedRepository so chrome can
 * only ever be touched within the active tenant (X-Site-Id). Layouts are
 * validated/repaired through @ob-cms/block-schema before they hit the DB.
 *
 * MVP: save = live. On save we enqueue a cache-purge of the site's render keys
 * (the public `render:<siteId>:site` envelope carries the chrome) so the
 * renderer picks up the change after revalidate.
 */
@Injectable()
export class SiteChromeService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  /** Current header/footer layouts for the active site (either may be null). */
  async get(): Promise<SiteChrome> {
    const row = await this.requireSettings();
    const header = await this.repairStaleReusableRefs(
      (row.headerLayout as SerializedLayout | null) ?? null,
    );
    const footer = await this.repairStaleReusableRefs(
      (row.footerLayout as SerializedLayout | null) ?? null,
    );
    return { header, footer };
  }

  /**
   * Update header and/or footer. A field omitted is left untouched; a field set
   * to `null` clears that slot. Each provided layout is validated through
   * block-schema. Triggers a render cache-purge so the change goes live.
   */
  async update(dto: UpdateSiteChromeDto, actor: AuthUser): Promise<SiteChrome> {
    await this.requireSettings();

    const patch: Partial<typeof siteSettings.$inferInsert> = { updatedBy: actor.userId };
    const changed: string[] = [];
    if (dto.header !== undefined) {
      patch.headerLayout = dto.header === null ? null : this.validateLayout(dto.header);
      changed.push("header");
    }
    if (dto.footer !== undefined) {
      patch.footerLayout = dto.footer === null ? null : this.validateLayout(dto.footer);
      changed.push("footer");
    }

    const [row] = await this.repo.db
      .update(siteSettings)
      .set(patch)
      .where(this.repo.scope(siteSettings))
      .returning();

    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "site_chrome.updated",
      category: "content",
      entityType: "site_settings",
      entityId: row.id,
      metadata: { slots: changed },
    });

    // MVP save = live: purge the render keys (render:<siteId>:site holds chrome).
    await this.queue.enqueueCachePurge({
      siteId: this.repo.siteId,
      entity: "chrome",
      entityId: row.id,
      slug: "/",
    });

    return {
      header: (row.headerLayout as SerializedLayout | null) ?? null,
      footer: (row.footerLayout as SerializedLayout | null) ?? null,
    };
  }

  // -- helpers ---------------------------------------------------------------

  private async requireSettings(): Promise<typeof siteSettings.$inferSelect> {
    const [row] = await this.repo.db
      .select()
      .from(siteSettings)
      .where(this.repo.scope(siteSettings))
      .limit(1);
    if (!row) throw new NotFoundException("Site settings not found");
    return row;
  }

  /** Validate + repair a layout through block-schema. Throws 400 on garbage. */
  private validateLayout(input: SerializedLayout): SerializedLayout {
    try {
      return deserializeLayout(JSON.stringify(input));
    } catch (err) {
      throw new BadRequestException(`Invalid layout: ${(err as Error).message}`);
    }
  }

  /**
   * Strip reusable-block nodes that point at deleted/missing rows so chrome
   * preview/render never 404s on a stale id left after a block was removed.
   */
  private async repairStaleReusableRefs(
    layout: SerializedLayout | null,
  ): Promise<SerializedLayout | null> {
    if (!layout?.nodes) return layout;

    const refIds = new Set<string>();
    for (const node of Object.values(layout.nodes)) {
      if (node.type?.resolvedName !== "Reusable Block") continue;
      const id = (node.props as { reusableBlockId?: string } | undefined)?.reusableBlockId;
      if (id) refIds.add(id);
    }
    if (refIds.size === 0) return layout;

    const rows = await this.repo.db
      .select({ id: reusableBlocks.id })
      .from(reusableBlocks)
      .where(
        and(
          eq(reusableBlocks.siteId, this.repo.siteId),
          isNull(reusableBlocks.deletedAt),
          inArray(reusableBlocks.id, [...refIds]),
        ),
      );
    const live = new Set(rows.map((r) => r.id));

    let repaired: SerializedLayout | null = layout;
    for (const id of refIds) {
      if (!live.has(id)) {
        repaired = scrubReusableBlockReferences(repaired, id);
      }
    }
    return repaired;
  }
}

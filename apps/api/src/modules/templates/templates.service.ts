import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull, or, type SQL } from "drizzle-orm";
import { deserializeLayout, sanitizeText } from "@ob-cms/block-schema";
import { pageTemplates, type PageTemplateRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { TenantContext } from "@common/tenancy/tenant-context";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { CreateTemplateDto, ListTemplatesQueryDto, UpdateTemplateDto } from "./dto/template.dto";

/**
 * Page/section templates. Reads return the tenant's own templates PLUS the
 * GLOBAL presets (siteId IS NULL) — so this service can't use the hard
 * ScopedRepository predicate for reads (it forbids NULL siteId). It instead ORs
 * `siteId = ctx.siteId OR siteId IS NULL` explicitly and ONLY writes/deletes
 * rows owned by the active site (global presets are seeded, never tenant-edited).
 */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly ctx: TenantContext,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListTemplatesQueryDto): Promise<PageTemplateRow[]> {
    const siteId = this.ctx.requireSiteId();
    const visibility = or(eq(pageTemplates.siteId, siteId), isNull(pageTemplates.siteId));
    const conds: Array<SQL | undefined> = [visibility, isNull(pageTemplates.deletedAt)];
    if (query.kind) conds.push(eq(pageTemplates.kind, query.kind));
    return this.repo.db
      .select()
      .from(pageTemplates)
      .where(and(...conds))
      .orderBy(desc(pageTemplates.createdAt))
      .limit(500);
  }

  /** Fetch a single template the active site may use (own or global). */
  async get(id: string): Promise<PageTemplateRow> {
    const siteId = this.ctx.requireSiteId();
    const [row] = await this.repo.db
      .select()
      .from(pageTemplates)
      .where(
        and(
          eq(pageTemplates.id, id),
          or(eq(pageTemplates.siteId, siteId), isNull(pageTemplates.siteId)),
          isNull(pageTemplates.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Template not found");
    return row;
  }

  async create(dto: CreateTemplateDto, actor: AuthUser): Promise<PageTemplateRow> {
    let layout: Record<string, unknown>;
    try {
      layout = deserializeLayout(JSON.stringify(dto.layout)) as unknown as Record<string, unknown>;
    } catch (err) {
      throw new BadRequestException(`Invalid layout: ${(err as Error).message}`);
    }
    // ScopedRepository.insertDefaults stamps the active siteId — tenant-owned.
    const [row] = await this.repo.db
      .insert(pageTemplates)
      .values({
        ...this.repo.insertDefaults(),
        name: sanitizeText(dto.name),
        kind: dto.kind ?? "page",
        layout: layout as unknown,
      })
      .returning();
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "template.created",
      category: "content",
      entityType: "page_template",
      entityId: row.id,
      metadata: { name: row.name, kind: row.kind },
    });
    return row;
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    // Hard-scoped delete: only the active site's OWN templates (never globals).
    const [row] = await this.repo.db
      .update(pageTemplates)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(pageTemplates, eq(pageTemplates.id, id)))
      .returning();
    if (!row) throw new NotFoundException("Template not found");
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "template.deleted",
      category: "content",
      entityType: "page_template",
      entityId: id,
    });
    return { ok: true };
  }

  /** Rename a site-owned template — global presets (siteId IS NULL) are not editable. */
  async update(id: string, dto: UpdateTemplateDto, actor: AuthUser): Promise<PageTemplateRow> {
    const name = sanitizeText(dto.name);
    if (!name) throw new BadRequestException("Template name is required");

    return this.repo.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(pageTemplates)
        .where(this.repo.scope(pageTemplates, eq(pageTemplates.id, id)))
        .limit(1)
        .for("update");
      if (!existing) throw new NotFoundException("Template not found");

      const [row] = await tx
        .update(pageTemplates)
        .set({ name, updatedBy: actor.userId })
        .where(this.repo.scope(pageTemplates, eq(pageTemplates.id, id)))
        .returning();
      if (!row) throw new NotFoundException("Template not found");

      await this.audit.record(
        {
          siteId: this.repo.siteId,
          actorId: actor.userId,
          action: "template.renamed",
          category: "content",
          entityType: "page_template",
          entityId: id,
          metadata: { oldName: existing.name, newName: row.name },
        },
        tx,
      );
      return row;
    });
  }
}

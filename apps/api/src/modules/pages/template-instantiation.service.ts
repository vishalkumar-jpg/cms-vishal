import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { deserializeLayout } from "@ob-cms/block-schema";
import type { PageRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { TenantContext } from "@common/tenancy/tenant-context";
import { TemplateSkeletonsService } from "@modules/template-skeletons/template-skeletons.service";
import type { CreatePageFromTemplateDto } from "./dto/page.dto";
import { PagesService } from "./pages.service";

/**
 * Coordinates the cross-domain "published skeleton → independent draft page"
 * workflow while leaving generic page persistence in {@link PagesService}.
 */
@Injectable()
export class TemplateInstantiationService {
  private readonly logger = new Logger(TemplateInstantiationService.name);

  constructor(
    private readonly skeletons: TemplateSkeletonsService,
    private readonly pages: PagesService,
    private readonly audit: AuditService,
    private readonly ctx: TenantContext,
  ) {}

  async instantiate(dto: CreatePageFromTemplateDto, actor: AuthUser): Promise<PageRow> {
    const skeleton = await this.resolveSkeleton(dto);
    if (skeleton.metadata.status !== "published") {
      throw new BadRequestException("Template skeleton must be published before instantiation");
    }

    // JSON round-trip + deserializeLayout creates a detached, validated and
    // repaired object graph. PagesService validates again at its write boundary.
    let layout: Record<string, unknown>;
    try {
      layout = deserializeLayout(
        JSON.stringify(skeleton.content.layout),
      ) as unknown as Record<string, unknown>;
    } catch (err) {
      throw new BadRequestException(`Invalid template layout: ${(err as Error).message}`);
    }

    const page = await this.pages.create(
      {
        title: dto.title,
        slug: dto.slug,
        parentId: dto.parentId,
        seo: dto.seo,
        draftLayout: layout,
      },
      actor,
      {
        provenance: {
          sourceTemplateId: skeleton.metadata.id,
          sourceTemplateKey: skeleton.metadata.templateKey,
          sourceTemplateVersion: skeleton.metadata.version,
          instantiatedAt: new Date(),
        },
      },
    );

    // Best-effort: the page is already persisted (and PagesService recorded its
    // own `page.created` entry), so an audit failure must not report the request
    // as failed — a retry would then collide on the slug.
    try {
      await this.audit.record({
        siteId: this.ctx.requireSiteId(),
        actorId: actor.userId,
        action: "page.created_from_template",
        category: "content",
        entityType: "page",
        entityId: page.id,
        metadata: {
          skeletonId: skeleton.metadata.id,
          templateKey: skeleton.metadata.templateKey,
          templateVersion: skeleton.metadata.version,
          slug: page.slug,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`audit page.created_from_template failed (${page.id}): ${message}`);
    }

    return page;
  }

  private resolveSkeleton(dto: CreatePageFromTemplateDto) {
    const hasId = Boolean(dto.skeletonId);
    const hasKey = Boolean(dto.templateKey);
    if (hasId === hasKey) {
      throw new BadRequestException("Provide exactly one of skeletonId or templateKey");
    }
    if (dto.skeletonId) return this.skeletons.getById(dto.skeletonId);
    if (dto.templateKey) return this.skeletons.getByKey(dto.templateKey);
    throw new BadRequestException("Provide exactly one of skeletonId or templateKey");
  }
}

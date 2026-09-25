import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { organizations, type OrganizationRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { CreateOrganizationDto, UpdateOrganizationDto } from "./dto/organization.dto";

/** Organizations are platform-level (super_admin only) — not site-scoped. */
@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateOrganizationDto, actor: AuthUser): Promise<OrganizationRow> {
    const [dupe] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, dto.slug))
      .limit(1);
    if (dupe) throw new ConflictException("Organization slug already in use");

    const [org] = await this.db
      .insert(organizations)
      .values({ name: dto.name, slug: dto.slug, createdBy: actor.userId })
      .returning();

    await this.audit.record({
      action: "organization.created",
      category: "platform",
      actorId: actor.userId,
      entityType: "organization",
      entityId: org.id,
      metadata: { slug: org.slug },
    });
    return org;
  }

  async list(): Promise<OrganizationRow[]> {
    return this.db.select().from(organizations).where(isNull(organizations.deletedAt));
  }

  async get(id: string): Promise<OrganizationRow> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .limit(1);
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  /**
   * Resolve the org for a new site. When `orgId` is provided it must exist;
   * otherwise the default platform org is used (created on first use).
   */
  async resolveOrgId(orgId: string | undefined, actor: AuthUser): Promise<string> {
    if (orgId) {
      const [org] = await this.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
        .limit(1);
      if (!org) throw new BadRequestException("Organization not found");
      return org.id;
    }
    const [existing] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.slug, "platform"), isNull(organizations.deletedAt)))
      .limit(1);
    if (existing) return existing.id;
    const [org] = await this.db
      .insert(organizations)
      .values({ name: "Platform", slug: "platform", createdBy: actor.userId })
      .returning();
    return org.id;
  }

  async update(id: string, dto: UpdateOrganizationDto, actor: AuthUser): Promise<OrganizationRow> {
    await this.get(id);
    const [org] = await this.db
      .update(organizations)
      .set({ ...dto, updatedBy: actor.userId })
      .where(eq(organizations.id, id))
      .returning();
    await this.audit.record({
      action: "organization.updated",
      category: "platform",
      actorId: actor.userId,
      entityType: "organization",
      entityId: id,
    });
    return org;
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq, sql } from "drizzle-orm";
import {
  audienceDefinitions,
  audienceMemberships,
  companies,
  identities,
  visitorProfiles,
} from "@database/schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import { evalGroup, type ProfileView, type RuleGroup } from "@modules/identity/rules";
import type { AudienceDto, AudiencePreviewDto } from "./dto/audiences.dto";

/**
 * Audiences service (Phase 3). CRUD over `audience_definitions` + a live preview
 * count + a materialized member list. The heavy recompute (write memberships)
 * runs in the worker; the API enqueues it. `preview` evaluates a rule group
 * against the current profiles IN-PROCESS so the admin gets an instant count.
 * All reads/writes are ScopedRepository-guarded (site-isolated).
 */
@Injectable()
export class AudiencesService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  /** Structural validation of the persisted rule tree (depth-limited). */
  private assertValidRules(rules: unknown, depth = 0): void {
    if (depth > 4) throw new BadRequestException("Rule tree too deep");
    const g = rules as RuleGroup;
    if (!g || (g.logic !== "and" && g.logic !== "or") || !Array.isArray(g.conditions)) {
      throw new BadRequestException("Invalid rules: expected { logic, conditions[] }");
    }
    for (const node of g.conditions) {
      if ((node as RuleGroup).logic) {
        this.assertValidRules(node, depth + 1);
      } else {
        const c = node as { field?: unknown; op?: unknown };
        if (typeof c.field !== "string" || typeof c.op !== "string") {
          throw new BadRequestException("Invalid condition: field/op required");
        }
      }
    }
  }

  // --- CRUD -----------------------------------------------------------------

  async list(): Promise<Array<typeof audienceDefinitions.$inferSelect & { members: number }>> {
    const rows = await this.repo.db
      .select({
        def: audienceDefinitions,
        members: sql<number>`count(${audienceMemberships.id})::int`,
      })
      .from(audienceDefinitions)
      .leftJoin(audienceMemberships, eq(audienceMemberships.audienceId, audienceDefinitions.id))
      .where(this.repo.scope(audienceDefinitions))
      .groupBy(audienceDefinitions.id)
      .orderBy(desc(audienceDefinitions.createdAt));
    return rows.map((r) => ({ ...r.def, members: Number(r.members) }));
  }

  async get(id: string): Promise<typeof audienceDefinitions.$inferSelect> {
    const [row] = await this.repo.db
      .select()
      .from(audienceDefinitions)
      .where(this.repo.scope(audienceDefinitions, eq(audienceDefinitions.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Audience not found");
    return row;
  }

  async create(dto: AudienceDto, user: AuthUser): Promise<typeof audienceDefinitions.$inferSelect> {
    this.assertValidRules(dto.rules);
    const [row] = await this.repo.db
      .insert(audienceDefinitions)
      .values({
        ...this.repo.insertDefaults(),
        name: dto.name,
        description: dto.description ?? null,
        rules: dto.rules,
      })
      .returning();
    await this.recordAudit(user, "audience.created", row.id, { name: dto.name });
    return row;
  }

  async update(
    id: string,
    dto: AudienceDto,
    user: AuthUser,
  ): Promise<typeof audienceDefinitions.$inferSelect> {
    this.assertValidRules(dto.rules);
    const [row] = await this.repo.db
      .update(audienceDefinitions)
      .set({
        name: dto.name,
        description: dto.description ?? null,
        rules: dto.rules,
        updatedBy: user.userId,
      })
      .where(this.repo.scope(audienceDefinitions, eq(audienceDefinitions.id, id)))
      .returning();
    if (!row) throw new NotFoundException("Audience not found");
    await this.recordAudit(user, "audience.updated", id, { name: dto.name });
    return row;
  }

  async remove(id: string, user: AuthUser): Promise<{ id: string }> {
    const [row] = await this.repo.db
      .update(audienceDefinitions)
      .set({ deletedAt: new Date(), updatedBy: user.userId })
      .where(this.repo.scope(audienceDefinitions, eq(audienceDefinitions.id, id)))
      .returning({ id: audienceDefinitions.id });
    if (!row) throw new NotFoundException("Audience not found");
    // Memberships cascade-delete on the definition FK, but the definition is
    // soft-deleted (not hard-deleted), so clear its memberships explicitly.
    await this.repo.db
      .delete(audienceMemberships)
      .where(this.repo.scope(audienceMemberships, eq(audienceMemberships.audienceId, id)));
    await this.recordAudit(user, "audience.deleted", id);
    return { id: row.id };
  }

  // --- Preview (in-process evaluation) --------------------------------------

  async preview(dto: AudiencePreviewDto): Promise<{ count: number; total: number }> {
    this.assertValidRules(dto.rules);
    const views = await this.loadProfileViews();
    const count = views.filter((v) => evalGroup(dto.rules, v)).length;
    return { count, total: views.length };
  }

  /** Load all site profiles as flattened ProfileViews for evaluation. */
  private async loadProfileViews(): Promise<ProfileView[]> {
    const rows = await this.repo.db
      .select({
        pageviews: visitorProfiles.pageviews,
        sessions: visitorProfiles.sessions,
        score: visitorProfiles.score,
        source: visitorProfiles.lastSource,
        device: visitorProfiles.lastDevice,
        identityId: visitorProfiles.identityId,
        topPaths: visitorProfiles.topPaths,
        email: identities.primaryEmail,
        companyId: identities.companyId,
        companyDomain: companies.domain,
      })
      .from(visitorProfiles)
      .leftJoin(identities, eq(identities.id, visitorProfiles.identityId))
      .leftJoin(companies, eq(companies.id, identities.companyId))
      .where(this.repo.scope(visitorProfiles));

    return rows.map((r) => ({
      pageviews: r.pageviews,
      sessions: r.sessions,
      score: r.score,
      source: r.source,
      device: r.device,
      isIdentified: !!r.identityId,
      hasCompany: !!r.companyId,
      paths: (r.topPaths ?? []).map((p) => p.path.toLowerCase()),
      email: r.email ?? null,
      companyDomain: r.companyDomain ?? null,
    }));
  }

  // --- Members --------------------------------------------------------------

  async members(id: string): Promise<
    Array<{
      visitorId: string;
      visitorProfileId: string;
      email: string | null;
      companyName: string | null;
      score: number;
      lastSeen: Date | null;
    }>
  > {
    await this.get(id); // 404 if not in this site
    const rows = await this.repo.db
      .select({
        visitorId: audienceMemberships.visitorId,
        visitorProfileId: audienceMemberships.visitorProfileId,
        email: identities.primaryEmail,
        companyName: companies.name,
        companyDomain: companies.domain,
        score: visitorProfiles.score,
        lastSeen: visitorProfiles.lastSeen,
      })
      .from(audienceMemberships)
      .leftJoin(visitorProfiles, eq(visitorProfiles.id, audienceMemberships.visitorProfileId))
      .leftJoin(identities, eq(identities.id, audienceMemberships.identityId))
      .leftJoin(companies, eq(companies.id, identities.companyId))
      .where(this.repo.scope(audienceMemberships, eq(audienceMemberships.audienceId, id)))
      .orderBy(desc(visitorProfiles.score))
      .limit(500);
    return rows.map((r) => ({
      visitorId: r.visitorId,
      visitorProfileId: r.visitorProfileId,
      email: r.email,
      companyName: r.companyName ?? r.companyDomain ?? null,
      score: r.score ?? 0,
      lastSeen: r.lastSeen,
    }));
  }

  async recompute(id: string, user: AuthUser): Promise<{ enqueued: boolean; jobId?: string }> {
    await this.get(id);
    const jobId = await this.queue.enqueueAudienceRecompute({ siteId: this.repo.siteId, audienceId: id });
    await this.recordAudit(user, "audience.recompute_requested", id);
    return { enqueued: true, jobId };
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
      entityType: "audience",
      entityId,
      metadata,
    });
  }
}

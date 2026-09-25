import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  analyticsEvents,
  companies,
  identities,
  scoringRules,
  visitorProfiles,
} from "@database/schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import { QueueService } from "@modules/queue/queue.service";
import { generateKSUIDWithPrefixSync } from "@utils/ksuid.utils";
import { emailDomain, isBusinessDomain } from "./rules";
import type { IdentifyDto, ScoringRuleDto, VisitorsQueryDto } from "./dto/identity.dto";

/**
 * Identity service (Phase 3). Two surfaces:
 *   - the @Public host-resolved IDENTIFY path (`/api/identify`) that links an
 *     email → visitorId: upserts an identity (by email, site-scoped), for a
 *     business-domain email upserts a company + links it, and links the
 *     visitor's profile → identity (best-effort; tolerant of missing profile),
 *   - the site-scoped reads/writes (visitors, identities, companies, scoring
 *     rules, rebuild) — all through ScopedRepository so no cross-tenant leak.
 */
@Injectable()
export class IdentityService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly resolver: SiteResolver,
    private readonly queue: QueueService,
  ) {}

  // --- Identify (@Public, host-resolved) ------------------------------------

  /**
   * Resolve the site from the Host, then upsert an identity by email (+ a
   * company for a business domain) and link the visitor's profile. Unknown host
   * → silently dropped. Fully best-effort: never throws to the caller (the
   * beacon contract is fire-and-forget).
   */
  async identify(host: string | undefined, dto: IdentifyDto): Promise<{ linked: boolean }> {
    const site = await this.resolver.resolve(host);
    if (!site) return { linked: false };
    try {
      await this.linkEmail(site.id, dto.visitorId, dto.email, dto.name);
      return { linked: true };
    } catch {
      return { linked: false };
    }
  }

  /**
   * Core identity-resolution primitive (also called by the forms-submit hook).
   * Site-scoped by the explicit siteId argument (NOT TenantContext — this runs
   * on public requests). Idempotent: re-identifying the same email/visitor is a
   * no-op beyond stats.
   */
  async linkEmail(
    siteId: string,
    visitorId: string,
    rawEmail: string,
    name?: string,
  ): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;

    // 1. Company identification by business-domain email.
    const domain = emailDomain(email);
    let companyId: string | null = null;
    if (isBusinessDomain(domain) && domain) {
      const [company] = await this.db
        .insert(companies)
        .values({ id: generateKSUIDWithPrefixSync("cmp"), siteId, domain })
        .onConflictDoUpdate({
          target: [companies.siteId, companies.domain],
          set: { updatedAt: new Date() },
        })
        .returning({ id: companies.id });
      companyId = company?.id ?? null;
    }

    // 2. Upsert the identity by (site, email).
    const [identity] = await this.db
      .insert(identities)
      .values({
        id: generateKSUIDWithPrefixSync("idt"),
        siteId,
        primaryEmail: email,
        name: name ?? null,
        companyId,
      })
      .onConflictDoUpdate({
        target: [identities.siteId, identities.primaryEmail],
        set: {
          name: name ?? sql`${identities.name}`,
          companyId: companyId ?? sql`${identities.companyId}`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: identities.id });
    const identityId = identity?.id;
    if (!identityId) return;

    // 3. Link the visitor's profile → identity. If the profile row does not yet
    //    exist (rebuild job hasn't run), create a stub so the link survives.
    await this.db
      .insert(visitorProfiles)
      .values({
        id: generateKSUIDWithPrefixSync("vpr"),
        siteId,
        visitorId,
        identityId,
      })
      .onConflictDoUpdate({
        target: [visitorProfiles.siteId, visitorProfiles.visitorId],
        set: { identityId, updatedAt: new Date() },
      });
  }

  // --- Visitors (site-scoped reads) -----------------------------------------

  async listVisitors(q: VisitorsQueryDto): Promise<
    Array<{
      id: string;
      visitorId: string;
      identityId: string | null;
      email: string | null;
      companyName: string | null;
      score: number;
      sessions: number;
      pageviews: number;
      lastSource: string | null;
      lastSeen: Date | null;
      identified: boolean;
    }>
  > {
    const limit = q.limit ?? 50;
    const sort =
      q.sort === "lastSeen"
        ? desc(visitorProfiles.lastSeen)
        : q.sort === "pageviews"
          ? desc(visitorProfiles.pageviews)
          : desc(visitorProfiles.score);

    const extra = q.identified ? isNotNull(visitorProfiles.identityId) : undefined;
    const rows = await this.repo.db
      .select({
        id: visitorProfiles.id,
        visitorId: visitorProfiles.visitorId,
        identityId: visitorProfiles.identityId,
        email: identities.primaryEmail,
        companyName: companies.name,
        companyDomain: companies.domain,
        score: visitorProfiles.score,
        sessions: visitorProfiles.sessions,
        pageviews: visitorProfiles.pageviews,
        lastSource: visitorProfiles.lastSource,
        lastSeen: visitorProfiles.lastSeen,
      })
      .from(visitorProfiles)
      .leftJoin(identities, eq(identities.id, visitorProfiles.identityId))
      .leftJoin(companies, eq(companies.id, identities.companyId))
      .where(this.repo.scope(visitorProfiles, extra))
      .orderBy(sort)
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      visitorId: r.visitorId,
      identityId: r.identityId,
      email: r.email,
      companyName: r.companyName ?? r.companyDomain ?? null,
      score: r.score,
      sessions: r.sessions,
      pageviews: r.pageviews,
      lastSource: r.lastSource,
      lastSeen: r.lastSeen,
      identified: !!r.identityId,
    }));
  }

  /** Visitor 360 — profile + identity + company + a recent event timeline. */
  async getVisitor(id: string): Promise<{
    profile: typeof visitorProfiles.$inferSelect;
    identity: { email: string; name: string | null } | null;
    company: { domain: string; name: string | null; industry: string | null; size: string | null } | null;
    timeline: Array<{ ts: Date; type: string; path: string; source: string; device: string }>;
  }> {
    const [profile] = await this.repo.db
      .select()
      .from(visitorProfiles)
      .where(this.repo.scope(visitorProfiles, eq(visitorProfiles.id, id)))
      .limit(1);
    if (!profile) throw new NotFoundException("Visitor not found");

    let identity: { email: string; name: string | null } | null = null;
    let company:
      | { domain: string; name: string | null; industry: string | null; size: string | null }
      | null = null;
    if (profile.identityId) {
      const [idn] = await this.repo.db
        .select({
          email: identities.primaryEmail,
          name: identities.name,
          companyId: identities.companyId,
        })
        .from(identities)
        .where(this.repo.scope(identities, eq(identities.id, profile.identityId)))
        .limit(1);
      if (idn) {
        identity = { email: idn.email, name: idn.name };
        if (idn.companyId) {
          const [cmp] = await this.repo.db
            .select({
              domain: companies.domain,
              name: companies.name,
              industry: companies.industry,
              size: companies.size,
            })
            .from(companies)
            .where(this.repo.scope(companies, eq(companies.id, idn.companyId)))
            .limit(1);
          company = cmp ?? null;
        }
      }
    }

    const events = await this.repo.db
      .select({
        ts: analyticsEvents.ts,
        type: analyticsEvents.type,
        path: analyticsEvents.path,
        source: analyticsEvents.source,
        device: analyticsEvents.deviceType,
      })
      .from(analyticsEvents)
      .where(this.repo.scope(analyticsEvents, eq(analyticsEvents.visitorId, profile.visitorId)))
      .orderBy(desc(analyticsEvents.ts))
      .limit(50);

    return { profile, identity, company, timeline: events };
  }

  async listIdentities(): Promise<
    Array<{
      id: string;
      primaryEmail: string;
      name: string | null;
      companyName: string | null;
      companyDomain: string | null;
      createdAt: Date;
    }>
  > {
    const rows = await this.repo.db
      .select({
        id: identities.id,
        primaryEmail: identities.primaryEmail,
        name: identities.name,
        companyName: companies.name,
        companyDomain: companies.domain,
        createdAt: identities.createdAt,
      })
      .from(identities)
      .leftJoin(companies, eq(companies.id, identities.companyId))
      .where(this.repo.scope(identities))
      .orderBy(desc(identities.createdAt))
      .limit(200);
    return rows;
  }

  async listCompanies(): Promise<
    Array<{
      id: string;
      domain: string;
      name: string | null;
      industry: string | null;
      size: string | null;
      people: number;
    }>
  > {
    const rows = await this.repo.db
      .select({
        id: companies.id,
        domain: companies.domain,
        name: companies.name,
        industry: companies.industry,
        size: companies.size,
        people: sql<number>`count(${identities.id})::int`,
      })
      .from(companies)
      .leftJoin(identities, eq(identities.companyId, companies.id))
      .where(this.repo.scope(companies))
      .groupBy(companies.id)
      .orderBy(desc(companies.createdAt))
      .limit(200);
    return rows.map((r) => ({ ...r, people: Number(r.people) }));
  }

  // --- Scoring rules (CRUD) -------------------------------------------------

  async listScoringRules(): Promise<Array<typeof scoringRules.$inferSelect>> {
    return this.repo.db
      .select()
      .from(scoringRules)
      .where(this.repo.scope(scoringRules))
      .orderBy(desc(scoringRules.createdAt));
  }

  async createScoringRule(dto: ScoringRuleDto, user: AuthUser): Promise<typeof scoringRules.$inferSelect> {
    const [row] = await this.repo.db
      .insert(scoringRules)
      .values({
        ...this.repo.insertDefaults(),
        name: dto.name,
        condition: dto.condition,
        points: dto.points,
        active: dto.active === false ? "false" : "true",
      })
      .returning();
    await this.recordAudit(user, "scoring_rule.created", row.id, { name: dto.name });
    return row;
  }

  async updateScoringRule(
    id: string,
    dto: ScoringRuleDto,
    user: AuthUser,
  ): Promise<typeof scoringRules.$inferSelect> {
    const [row] = await this.repo.db
      .update(scoringRules)
      .set({
        name: dto.name,
        condition: dto.condition,
        points: dto.points,
        active: dto.active === false ? "false" : "true",
        updatedBy: user.userId,
      })
      .where(this.repo.scope(scoringRules, eq(scoringRules.id, id)))
      .returning();
    if (!row) throw new NotFoundException("Scoring rule not found");
    await this.recordAudit(user, "scoring_rule.updated", id, { name: dto.name });
    return row;
  }

  async deleteScoringRule(id: string, user: AuthUser): Promise<{ id: string }> {
    const [row] = await this.repo.db
      .update(scoringRules)
      .set({ deletedAt: new Date(), updatedBy: user.userId })
      .where(this.repo.scope(scoringRules, eq(scoringRules.id, id)))
      .returning({ id: scoringRules.id });
    if (!row) throw new NotFoundException("Scoring rule not found");
    await this.recordAudit(user, "scoring_rule.deleted", id);
    return { id: row.id };
  }

  // --- Rebuild (enqueue the worker recompute) -------------------------------

  async enqueueRebuild(user: AuthUser): Promise<{ enqueued: boolean; jobId?: string }> {
    const siteId = this.repo.siteId;
    const jobId = await this.queue.enqueueProfileRebuild({ siteId });
    await this.recordAudit(user, "identity.rebuild_requested", siteId);
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
      entityType: "identity",
      entityId,
      metadata,
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { RESERVED_SUBDOMAINS } from "@ob-cms/shared";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  formSubmissions,
  forms,
  organizations,
  pages,
  siteDomains,
  siteMembers,
  siteSettings,
  sites,
  systemUsers,
  type SiteRow,
} from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { PlatformCreateSiteDto } from "./dto/platform.dto";

export interface PlatformOverview {
  sites: number;
  users: number;
  pages: number;
  publishedPages: number;
  forms: number;
  submissions: number;
  domains: number;
}

export interface PlatformSiteCounts {
  pages: number;
  publishedPages: number;
  members: number;
  forms: number;
  domains: number;
}

export interface PlatformSite {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  primaryDomain: string | null;
  customDomain: string | null;
  status: string;
  visibility: string;
  createdAt: Date;
  counts: PlatformSiteCounts;
}

export interface PlatformUser {
  id: string;
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
  status: string;
  createdAt: Date;
}

/**
 * Cross-tenant platform-admin operations (the super-admin console). EVERY
 * method here is GUARDED upstream by {@link PlatformAdminGuard} (the controller
 * is `@PlatformAdmin()`), so these intentionally BYPASS the per-site
 * TenantContext / ScopedRepository and query the raw `db` across ALL tenants.
 *
 * Never inject the ScopedRepository here — it would fail-closed (no active
 * site) and defeats the whole point of a central view.
 */
@Injectable()
export class PlatformService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /** Platform-wide totals aggregated across every tenant. */
  async overview(): Promise<PlatformOverview> {
    const total = sql<number>`count(*)::int`;
    const [siteAgg] = await this.db
      .select({ total })
      .from(sites)
      .where(isNull(sites.deletedAt));
    const [userAgg] = await this.db
      .select({ total })
      .from(systemUsers)
      .where(isNull(systemUsers.deletedAt));
    const [pageAgg] = await this.db
      .select({
        total,
        published: sql<number>`count(*) filter (where ${pages.status} = 'published')::int`,
      })
      .from(pages)
      .where(isNull(pages.deletedAt));
    const [formAgg] = await this.db
      .select({ total })
      .from(forms)
      .where(isNull(forms.deletedAt));
    const [submissionAgg] = await this.db
      .select({ total })
      .from(formSubmissions)
      .where(isNull(formSubmissions.deletedAt));
    const [domainAgg] = await this.db
      .select({ total })
      .from(siteDomains)
      .where(isNull(siteDomains.deletedAt));

    return {
      sites: Number(siteAgg?.total ?? 0),
      users: Number(userAgg?.total ?? 0),
      pages: Number(pageAgg?.total ?? 0),
      publishedPages: Number(pageAgg?.published ?? 0),
      forms: Number(formAgg?.total ?? 0),
      submissions: Number(submissionAgg?.total ?? 0),
      domains: Number(domainAgg?.total ?? 0),
    };
  }

  /** ALL sites (every tenant) with per-site stats. Newest first. */
  async listSites(): Promise<PlatformSite[]> {
    const rows = await this.db
      .select()
      .from(sites)
      .where(isNull(sites.deletedAt))
      .orderBy(desc(sites.createdAt));

    // Aggregate per-site counts in one query per table (avoids N+1).
    const pageRows = await this.db
      .select({
        siteId: pages.siteId,
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${pages.status} = 'published')::int`,
      })
      .from(pages)
      .where(isNull(pages.deletedAt))
      .groupBy(pages.siteId);
    const pageCounts = new Map(
      pageRows.map((r) => [r.siteId, { total: Number(r.total), published: Number(r.published) }]),
    );

    const formRows = await this.db
      .select({ siteId: forms.siteId, total: sql<number>`count(*)::int` })
      .from(forms)
      .where(isNull(forms.deletedAt))
      .groupBy(forms.siteId);
    const formCounts = new Map(formRows.map((r) => [r.siteId, Number(r.total)]));

    const domainRows = await this.db
      .select({ siteId: siteDomains.siteId, total: sql<number>`count(*)::int` })
      .from(siteDomains)
      .where(isNull(siteDomains.deletedAt))
      .groupBy(siteDomains.siteId);
    const domainCounts = new Map(domainRows.map((r) => [r.siteId, Number(r.total)]));

    const memberCounts = await this.memberCounts();

    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      subdomain: s.subdomain,
      primaryDomain: s.primaryDomain ?? null,
      customDomain: s.customDomain ?? null,
      status: s.status,
      visibility: s.visibility,
      createdAt: s.createdAt,
      counts: {
        pages: pageCounts.get(s.id)?.total ?? 0,
        publishedPages: pageCounts.get(s.id)?.published ?? 0,
        members: memberCounts.get(s.id) ?? 0,
        forms: formCounts.get(s.id) ?? 0,
        domains: domainCounts.get(s.id) ?? 0,
      },
    }));
  }

  /** All platform/system users (identity records). Newest first. */
  async listUsers(): Promise<PlatformUser[]> {
    const rows = await this.db
      .select({
        id: systemUsers.id,
        email: systemUsers.email,
        name: systemUsers.name,
        isPlatformAdmin: systemUsers.isPlatformAdmin,
        status: systemUsers.status,
        createdAt: systemUsers.createdAt,
      })
      .from(systemUsers)
      .where(isNull(systemUsers.deletedAt))
      .orderBy(desc(systemUsers.createdAt));
    return rows;
  }

  /**
   * Create a new tenant/site from the platform console. Resolves (or creates) a
   * default organization, then transactionally inserts the site + default
   * settings + makes the acting platform admin a site_admin member.
   */
  async createSite(dto: PlatformCreateSiteDto, actor: AuthUser): Promise<SiteRow> {
    const subdomain = dto.subdomain;
    const slug = dto.slug ?? subdomain;
    if (RESERVED_SUBDOMAINS.includes(subdomain as never)) {
      throw new BadRequestException("That subdomain is reserved");
    }
    await this.assertUnique(slug, subdomain);
    const orgId = await this.resolveOrgId(dto.orgId, actor);

    return this.db.transaction(async (tx) => {
      const [site] = await tx
        .insert(sites)
        .values({
          orgId,
          name: dto.name,
          slug,
          subdomain,
          ownerId: actor.userId,
          createdBy: actor.userId,
        })
        .returning();

      await tx.insert(siteSettings).values({ siteId: site.id, createdBy: actor.userId });
      await tx.insert(siteMembers).values({
        siteId: site.id,
        userId: actor.userId,
        role: "site_admin",
        invitedBy: actor.userId,
        createdBy: actor.userId,
      });
      await this.audit.record(
        {
          siteId: site.id,
          actorId: actor.userId,
          action: "platform.site.created",
          category: "settings",
          entityType: "site",
          entityId: site.id,
          metadata: { slug: site.slug, subdomain: site.subdomain },
        },
        tx as unknown as Database,
      );
      return site;
    });
  }

  /** Suspend a site (stops the public runtime from serving it). Audited. */
  suspendSite(siteId: string, actor: AuthUser): Promise<SiteRow> {
    return this.setStatus(siteId, "suspended", actor);
  }

  /** Re-activate a suspended site. Audited. */
  activateSite(siteId: string, actor: AuthUser): Promise<SiteRow> {
    return this.setStatus(siteId, "active", actor);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async setStatus(
    siteId: string,
    status: "active" | "suspended",
    actor: AuthUser,
  ): Promise<SiteRow> {
    const [existing] = await this.db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.id, siteId), isNull(sites.deletedAt)))
      .limit(1);
    if (!existing) throw new NotFoundException("Site not found");

    const [site] = await this.db
      .update(sites)
      .set({ status, updatedBy: actor.userId })
      .where(eq(sites.id, siteId))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: status === "suspended" ? "platform.site.suspended" : "platform.site.activated",
      category: "settings",
      entityType: "site",
      entityId: siteId,
      metadata: { status },
    });
    return site;
  }

  private async resolveOrgId(orgId: string | undefined, actor: AuthUser): Promise<string> {
    if (orgId) {
      const [org] = await this.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
        .limit(1);
      if (!org) throw new BadRequestException("Organization not found");
      return org.id;
    }
    // Default platform org (shared parent for console-created tenants).
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

  private async assertUnique(slug: string, subdomain: string): Promise<void> {
    const [bySlug] = await this.db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.slug, slug))
      .limit(1);
    if (bySlug) throw new ConflictException("Site slug already in use");
    const [bySub] = await this.db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.subdomain, subdomain))
      .limit(1);
    if (bySub) throw new ConflictException("Subdomain already in use");
  }

  /** Active members per site (excludes the platform-level siteId IS NULL row). */
  private async memberCounts(): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ siteId: siteMembers.siteId, total: sql<number>`count(*)::int` })
      .from(siteMembers)
      .where(and(eq(siteMembers.status, "active"), isNull(siteMembers.deletedAt)))
      .groupBy(siteMembers.siteId);
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.siteId) map.set(r.siteId, Number(r.total));
    }
    return map;
  }
}

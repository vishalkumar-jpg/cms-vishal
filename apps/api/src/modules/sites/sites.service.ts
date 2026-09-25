import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { RESERVED_SUBDOMAINS } from "@ob-cms/shared";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  organizations,
  siteMembers,
  siteSettings,
  sites,
  type SiteRow,
  type SiteSettingsRow,
} from "@database/schema";
import type { SiteCdnConfig, SiteIntegrations } from "@database/schema/site-settings.schema";
import { AuditService } from "@common/audit/audit.service";
import { MembershipService } from "@common/tenancy/membership.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import type { CreateSiteDto, UpdateSiteDto, UpdateSiteSettingsDto } from "./dto/site.dto";
import type {
  CachePurgeDto,
  UpdateCdnDto,
  UpdateIntegrationsDto,
  UpdateLocalesDto,
} from "./dto/site-settings-hub.dto";

/** The resolved locale set for a site (i18n B13). */
export interface SiteLocales {
  defaultLocale: string;
  locales: string[];
}

@Injectable()
export class SitesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly membership: MembershipService,
    private readonly queue: QueueService,
  ) {}

  /**
   * Create a site (FND-11/12). Transactional: site + default settings + owner
   * site_admin membership + audit event commit together.
   */
  async create(dto: CreateSiteDto, actor: AuthUser): Promise<SiteRow> {
    if (RESERVED_SUBDOMAINS.includes(dto.subdomain as never)) {
      throw new BadRequestException("That subdomain is reserved");
    }
    const orgId = await this.resolveOrgId(dto.orgId, actor);

    await this.assertUnique(dto.slug, dto.subdomain);
    const ownerId = dto.ownerId ?? actor.userId;

    return this.db.transaction(async (tx) => {
      const [site] = await tx
        .insert(sites)
        .values({
          orgId,
          name: dto.name,
          slug: dto.slug,
          subdomain: dto.subdomain,
          ownerId,
          createdBy: actor.userId,
        })
        .returning();

      await tx.insert(siteSettings).values({ siteId: site.id, createdBy: actor.userId });
      await tx.insert(siteMembers).values({
        siteId: site.id,
        userId: ownerId,
        role: "site_admin",
        invitedBy: actor.userId,
        createdBy: actor.userId,
      });
      await this.audit.record(
        {
          siteId: site.id,
          actorId: actor.userId,
          action: "site.created",
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

  /**
   * Resolve the owning organization for a new site. The CreateSiteWizard does
   * not know org ids, so `orgId` is optional and auto-resolved:
   *   1. explicit `dto.orgId` → validated (must exist, not deleted);
   *   2. the one org the caller's site memberships belong to, if unambiguous;
   *   3. the platform's ONLY active org (first-run wizard: the seeded
   *      "officebeacon" org, before the caller has any site memberships).
   * With several orgs and no membership signal we refuse rather than guess —
   * the client must pass orgId explicitly.
   */
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

    // 2. Derive from the caller's existing sites (skip the siteId-NULL
    //    platform-admin row). One distinct org → that's their org.
    const memberships = await this.membership.listMemberships(actor.userId);
    const siteIds = memberships.map((m) => m.siteId).filter((s): s is string => Boolean(s));
    if (siteIds.length > 0) {
      const rows = await this.db
        .select({ orgId: sites.orgId })
        .from(sites)
        .where(and(inArray(sites.id, siteIds), isNull(sites.deletedAt)));
      const orgIds = [...new Set(rows.map((r) => r.orgId))];
      if (orgIds.length === 1) return orgIds[0];
    }

    // 3. Single-org platform (the OfficeBeacon-internal deployment shape).
    const orgs = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(isNull(organizations.deletedAt))
      .limit(2);
    if (orgs.length === 1) return orgs[0].id;

    throw new BadRequestException(
      orgs.length === 0
        ? "No organization exists yet — create one first"
        : "Multiple organizations exist — pass orgId to choose which one owns the site",
    );
  }

  /** List sites the caller can see (super_admin → all; others → their memberships). */
  async list(actor: AuthUser): Promise<SiteRow[]> {
    if (actor.isPlatformAdmin) {
      return this.db.select().from(sites).where(isNull(sites.deletedAt));
    }
    const memberships = await this.membership.listMemberships(actor.userId);
    const siteIds = memberships.map((m) => m.siteId).filter((s): s is string => Boolean(s));
    if (siteIds.length === 0) return [];
    return this.db
      .select()
      .from(sites)
      .where(and(inArray(sites.id, siteIds), isNull(sites.deletedAt)));
  }

  /** Get one site. The TenantGuard already verified membership on :siteId. */
  async get(siteId: string): Promise<SiteRow> {
    const [site] = await this.db
      .select()
      .from(sites)
      .where(and(eq(sites.id, siteId), isNull(sites.deletedAt)))
      .limit(1);
    if (!site) throw new NotFoundException("Site not found");
    return site;
  }

  async update(siteId: string, dto: UpdateSiteDto, actor: AuthUser): Promise<SiteRow> {
    await this.get(siteId);
    const patch: Partial<SiteRow> = { ...dto, updatedBy: actor.userId };
    if (dto.visibility === "public") patch.publishedAt = new Date();
    const [site] = await this.db
      .update(sites)
      .set(patch)
      .where(eq(sites.id, siteId))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "site.updated",
      category: "settings",
      entityType: "site",
      entityId: siteId,
      metadata: { ...dto },
    });
    return site;
  }

  async archive(siteId: string, actor: AuthUser): Promise<{ ok: true }> {
    await this.get(siteId);
    await this.db
      .update(sites)
      .set({ deletedAt: new Date(), visibility: "archived", updatedBy: actor.userId })
      .where(eq(sites.id, siteId));
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "site.archived",
      category: "settings",
      entityType: "site",
      entityId: siteId,
    });
    return { ok: true };
  }

  async getSettings(siteId: string): Promise<SiteSettingsRow> {
    const [row] = await this.db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.siteId, siteId))
      .limit(1);
    if (!row) throw new NotFoundException("Settings not found");
    return row;
  }

  async updateSettings(
    siteId: string,
    dto: UpdateSiteSettingsDto,
    actor: AuthUser,
  ): Promise<SiteSettingsRow> {
    await this.getSettings(siteId);
    const [row] = await this.db
      .update(siteSettings)
      .set({ ...dto, updatedBy: actor.userId })
      .where(eq(siteSettings.siteId, siteId))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "settings.updated",
      category: "settings",
      entityType: "site_settings",
      entityId: row.id,
      metadata: { fields: Object.keys(dto) },
    });
    return row;
  }

  // -- i18n / localization (B13) ---------------------------------------------

  /** The site's locale set (defaults keep existing sites single-locale). */
  async getLocales(siteId: string): Promise<SiteLocales> {
    const row = await this.getSettings(siteId);
    return normalizeLocales(row.defaultLocale, row.locales);
  }

  /**
   * Replace the site's locale set. The default locale is always forced into the
   * `locales` array (a site must publish its default). Removing a locale does NOT
   * delete existing translation rows for that locale — they simply stop being
   * advertised (so the change is reversible). Save = live: purge render cache.
   */
  async updateLocales(
    siteId: string,
    dto: UpdateLocalesDto,
    actor: AuthUser,
  ): Promise<SiteLocales> {
    const current = await this.getSettings(siteId);
    const next = normalizeLocales(dto.defaultLocale, [dto.defaultLocale, ...dto.locales]);
    const [row] = await this.db
      .update(siteSettings)
      .set({
        defaultLocale: next.defaultLocale,
        locales: next.locales,
        updatedBy: actor.userId,
      })
      .where(eq(siteSettings.siteId, siteId))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "settings.locales.updated",
      category: "settings",
      entityType: "site_settings",
      entityId: current.id,
      metadata: { defaultLocale: next.defaultLocale, locales: next.locales },
    });
    await this.purgeRenderCache(siteId, row.id);
    return normalizeLocales(row.defaultLocale, row.locales);
  }

  // -- Site Settings hub (integrations #32 + CDN #31) ------------------------

  /** The active integrations config (back-compat: falls back to legacy columns). */
  async getIntegrations(siteId: string): Promise<SiteIntegrations> {
    const row = await this.getSettings(siteId);
    const saved = (row.integrations as SiteIntegrations | null) ?? {};
    // Mirror the legacy columns when the jsonb has no value yet.
    return {
      ga4MeasurementId: saved.ga4MeasurementId ?? row.ga4TrackingId ?? undefined,
      gtmId: saved.gtmId,
      liveChatId: saved.liveChatId ?? row.tawkToId ?? undefined,
      headScripts: saved.headScripts,
      bodyScripts: saved.bodyScripts,
    };
  }

  /**
   * Replace the integrations config. The provided object is the full desired
   * state (omitted keys clear). GA4/chat ids are mirrored into the legacy
   * `ga4TrackingId`/`tawkToId` columns so existing readers stay correct. Save =
   * live: purge the site's render cache so `/api/v1/public/site` re-emits.
   */
  async updateIntegrations(
    siteId: string,
    dto: UpdateIntegrationsDto,
    actor: AuthUser,
  ): Promise<SiteIntegrations> {
    const current = await this.getSettings(siteId);
    const integrations: SiteIntegrations = {
      ga4MeasurementId: dto.ga4MeasurementId || undefined,
      gtmId: dto.gtmId || undefined,
      liveChatId: dto.liveChatId || undefined,
      headScripts: dto.headScripts || undefined,
      bodyScripts: dto.bodyScripts || undefined,
    };
    const [row] = await this.db
      .update(siteSettings)
      .set({
        integrations,
        ga4TrackingId: integrations.ga4MeasurementId ?? null,
        tawkToId: integrations.liveChatId ?? null,
        updatedBy: actor.userId,
      })
      .where(eq(siteSettings.siteId, siteId))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "settings.integrations.updated",
      category: "settings",
      entityType: "site_settings",
      entityId: current.id,
      metadata: { fields: Object.keys(integrations).filter((k) => integrations[k as keyof SiteIntegrations]) },
    });
    await this.purgeRenderCache(siteId, row.id);
    return (row.integrations as SiteIntegrations | null) ?? {};
  }

  /** The active CDN cache config. */
  async getCdn(siteId: string): Promise<SiteCdnConfig> {
    const row = await this.getSettings(siteId);
    return (row.cdn as SiteCdnConfig | null) ?? {};
  }

  /** Replace the CDN cache config (store-only in MVP; edge enforcement future). */
  async updateCdn(siteId: string, dto: UpdateCdnDto, actor: AuthUser): Promise<SiteCdnConfig> {
    const current = await this.getSettings(siteId);
    const cdn: SiteCdnConfig = {
      defaultTtlSeconds: dto.defaultTtlSeconds,
      rules: dto.rules?.map((r) => ({ pattern: r.pattern, ttl: r.ttl })),
    };
    const [row] = await this.db
      .update(siteSettings)
      .set({ cdn, updatedBy: actor.userId })
      .where(eq(siteSettings.siteId, siteId))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "settings.cdn.updated",
      category: "settings",
      entityType: "site_settings",
      entityId: current.id,
      metadata: { defaultTtlSeconds: cdn.defaultTtlSeconds, rules: cdn.rules?.length ?? 0 },
    });
    return (row.cdn as SiteCdnConfig | null) ?? {};
  }

  /**
   * Manual cache purge (CDN tab). `scope: 'all'` clears every render key for the
   * site; `scope: 'path'` targets one path's page key (the worker also sweeps
   * `render:<siteId>:*`). Enqueues the existing cache-purge job. Audited.
   */
  async purgeCache(
    siteId: string,
    dto: CachePurgeDto,
    actor: AuthUser,
  ): Promise<{ enqueued: boolean; scope: string; path?: string }> {
    const settings = await this.getSettings(siteId);
    const scope = dto.scope ?? "all";
    const path = scope === "path" ? dto.path || "/" : "/";
    await this.queue.enqueueCachePurge({
      siteId,
      entity: "chrome",
      entityId: settings.id,
      slug: path,
    });
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "settings.cache.purged",
      category: "settings",
      entityType: "site_settings",
      entityId: settings.id,
      metadata: { scope, path },
    });
    return { enqueued: true, scope, path: scope === "path" ? path : undefined };
  }

  /** Enqueue a render-cache purge so a settings change goes live. */
  private async purgeRenderCache(siteId: string, settingsId: string): Promise<void> {
    await this.queue.enqueueCachePurge({
      siteId,
      entity: "chrome",
      entityId: settingsId,
      slug: "/",
    });
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
}

/**
 * Normalize a site's locale set: dedupe, ensure the default is present + first,
 * and tolerate legacy/null storage (older rows predating i18n) by falling back
 * to a single-locale ["en"]. Pure — shared by the service + public render.
 */
export function normalizeLocales(
  defaultLocale: string | null | undefined,
  locales: unknown,
): SiteLocales {
  const def = (defaultLocale || "en").toLowerCase();
  const raw = Array.isArray(locales) ? (locales as unknown[]) : [];
  const cleaned = raw
    .filter((l): l is string => typeof l === "string" && l.length > 0)
    .map((l) => l.toLowerCase());
  const set = [def, ...cleaned];
  const deduped = [...new Set(set)];
  return { defaultLocale: def, locales: deduped };
}

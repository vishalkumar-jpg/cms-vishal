import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { consentRecords, siteSettings } from "@database/schema";
import type {
  SiteConsentConfig,
  SiteRetentionConfig,
} from "@database/schema/site-settings.schema";
import { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import type {
  ConsentLogDto,
  UpdateConsentConfigDto,
  UpdateRetentionConfigDto,
} from "./dto/consent.dto";

/** Sensible defaults so a site that never touched the config still behaves. */
const DEFAULT_CONSENT: SiteConsentConfig = {
  enabled: false,
  mode: "all",
  position: "bottom",
  policyVersion: "1",
};
const DEFAULT_RETENTION: SiteRetentionConfig = {
  rawEventRetentionDays: 400,
  piiRetentionDays: 0,
};

/**
 * Consent Management (Privacy & Consent suite). Two surfaces:
 *  1. Site-scoped CONFIG (site_admin) — the consent banner + retention windows,
 *     stored as jsonb on `site_settings` and published on `/api/v1/public/site`.
 *  2. A @Public host-resolved CONSENT LOG write (`POST /api/consent`) — the
 *     append-only proof-of-consent ledger. Best-effort; never blocks the visitor.
 *
 * Config reads/writes are keyed by an explicit `:siteId` path param (the caller
 * is an authenticated site_admin; the TenantGuard has already proven membership
 * of the active X-Site-Id), mirroring SitesService's Site-Settings-hub methods.
 * The public log write resolves the tenant from the Host header (client siteId
 * is NEVER trusted) and uses the raw `db`.
 */
@Injectable()
export class ConsentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly resolver: SiteResolver,
  ) {}

  // -- Config (site_admin) ----------------------------------------------------

  /** The active consent config (merged over defaults). */
  async getConfig(siteId: string): Promise<SiteConsentConfig> {
    const row = await this.requireSettings(siteId);
    return { ...DEFAULT_CONSENT, ...((row.consent as SiteConsentConfig | null) ?? {}) };
  }

  /** Replace the consent config. Save = live: purge the render cache. */
  async updateConfig(
    siteId: string,
    dto: UpdateConsentConfigDto,
    actor: AuthUser,
  ): Promise<SiteConsentConfig> {
    const current = await this.requireSettings(siteId);
    // The DTO is the full desired state; strip undefined so omitted keys clear.
    const consent = pruneUndefined({ ...DEFAULT_CONSENT, ...dto }) as SiteConsentConfig;
    const [row] = await this.db
      .update(siteSettings)
      .set({ consent, updatedBy: actor.userId })
      .where(eq(siteSettings.siteId, siteId))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "consent.config_updated",
      category: "settings",
      entityType: "site_settings",
      entityId: current.id,
      metadata: { enabled: consent.enabled, mode: consent.mode, policyVersion: consent.policyVersion },
    });
    await this.purge(siteId, row.id);
    return (row.consent as SiteConsentConfig | null) ?? consent;
  }

  /** The active retention config (merged over defaults). */
  async getRetention(siteId: string): Promise<SiteRetentionConfig> {
    const row = await this.requireSettings(siteId);
    return { ...DEFAULT_RETENTION, ...((row.retention as SiteRetentionConfig | null) ?? {}) };
  }

  /** Replace the retention config (drives the worker's daily purge). */
  async updateRetention(
    siteId: string,
    dto: UpdateRetentionConfigDto,
    actor: AuthUser,
  ): Promise<SiteRetentionConfig> {
    const current = await this.requireSettings(siteId);
    const retention = pruneUndefined({ ...DEFAULT_RETENTION, ...dto }) as SiteRetentionConfig;
    const [row] = await this.db
      .update(siteSettings)
      .set({ retention, updatedBy: actor.userId })
      .where(eq(siteSettings.siteId, siteId))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "consent.retention_updated",
      category: "settings",
      entityType: "site_settings",
      entityId: current.id,
      metadata: { ...retention },
    });
    return (row.retention as SiteRetentionConfig | null) ?? retention;
  }

  /** Recent proof-of-consent records for the admin (site-scoped). */
  async recentRecords(siteId: string, limit = 50): Promise<Array<typeof consentRecords.$inferSelect>> {
    return this.db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.siteId, siteId))
      .orderBy(desc(consentRecords.ts))
      .limit(Math.min(Math.max(limit, 1), 200));
  }

  // -- Public log (host-resolved, best-effort) --------------------------------

  /**
   * Record a proof-of-consent decision. Host-resolved; a client siteId is never
   * trusted. Swallows all errors so a beacon never surfaces an error to the
   * visitor (the cookie is the live gate — this is a durable audit trail).
   */
  async log(host: string | undefined, dto: ConsentLogDto, ip: string | undefined): Promise<void> {
    try {
      const site = await this.resolver.resolve(host);
      if (!site) return;
      await this.db.insert(consentRecords).values({
        siteId: site.id,
        visitorId: dto.visitorId ?? null,
        analytics: !!dto.analytics,
        marketing: !!dto.marketing,
        method: dto.method ?? "custom",
        policyVersion: dto.policyVersion ?? null,
        ipHash: ip ? createHash("sha256").update(ip).digest("hex") : null,
        meta: dto.path ? { path: dto.path } : null,
      });
    } catch {
      /* best-effort — proof-of-consent is never on the critical path */
    }
  }

  // -- helpers ----------------------------------------------------------------

  private async requireSettings(siteId: string): Promise<typeof siteSettings.$inferSelect> {
    const [row] = await this.db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.siteId, siteId))
      .limit(1);
    if (!row) throw new NotFoundException("Site settings not found");
    return row;
  }

  private async purge(siteId: string, settingsId: string): Promise<void> {
    await this.queue.enqueueCachePurge({ siteId, entity: "chrome", entityId: settingsId, slug: "/" });
  }
}

/** Drop keys whose value is `undefined` so a partial DTO clears omitted fields. */
function pruneUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

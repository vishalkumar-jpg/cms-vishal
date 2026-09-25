import { promises as dns } from "node:dns";
import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { siteDomains, sites, type SiteDomainRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { QueueService } from "@modules/queue/queue.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { getOsEnvOptional } from "@config/env.config";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import { TLS_SERVICE, type TlsService } from "./tls.service";
import type { CreateDomainDto } from "./dto/domain.dto";

/** Days-before-expiry threshold at which a cert is flagged "expiring-soon". */
const EXPIRING_SOON_DAYS = 30;

/** Computed SSL/cert status derived from `tlsExpiresAt`. */
export type CertStatus = "unknown" | "ok" | "expiring-soon" | "expired" | "error";

/** A domain row enriched with the computed cert status + days-to-expiry. */
export interface DomainView extends SiteDomainRow {
  certStatus: CertStatus;
  daysToExpiry: number | null;
}

/** TXT record host prefix the owner publishes to prove ownership. */
const VERIFY_PREFIX = "_ob-verify";
/** TXT value prefix: the full record value is `ob-verify=<token>`. */
const VERIFY_VALUE_PREFIX = "ob-verify=";

/** DNS setup instructions returned to the tenant after adding a domain. */
export interface DnsInstructions {
  /** TXT record proving ownership. */
  txtRecord: { name: string; type: "TXT"; value: string };
  /** Routing record pointing the domain at the platform. */
  routing: { type: "CNAME" | "A"; name: string; value: string };
}

export interface VerifyResult {
  domain: SiteDomainRow;
  verified: boolean;
  reason?: string;
}

@Injectable()
export class DomainsService {
  constructor(
    private readonly repo: ScopedRepository,
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly resolver: SiteResolver,
    private readonly queue: QueueService,
    @Inject(TLS_SERVICE) private readonly tls: TlsService,
  ) {}

  /** The platform host tenants point their CNAME/A record at. */
  private platformHost(): string {
    return getOsEnvOptional("PLATFORM_DOMAIN") || "app.ob-cms.local";
  }

  buildInstructions(domain: string, token: string): DnsInstructions {
    return {
      txtRecord: {
        name: `${VERIFY_PREFIX}.${domain}`,
        type: "TXT",
        value: `${VERIFY_VALUE_PREFIX}${token}`,
      },
      routing: { type: "CNAME", name: domain, value: this.platformHost() },
    };
  }

  async list(): Promise<DomainView[]> {
    const rows = await this.repo.db
      .select()
      .from(siteDomains)
      .where(this.repo.scope(siteDomains))
      .orderBy(desc(siteDomains.createdAt))
      .limit(500);
    return rows.map((r) => this.toView(r));
  }

  /** Enrich a domain row with the computed cert status + days-to-expiry. */
  private toView(r: SiteDomainRow): DomainView {
    const { certStatus, daysToExpiry } = this.computeCertStatus(r);
    return { ...r, certStatus, daysToExpiry };
  }

  /**
   * Compute the SSL cert status from `tlsExpiresAt`/`tlsCheckError`:
   * `expired` (past), `expiring-soon` (<30d), `ok` (>=30d), `error` (probe
   * failed with no expiry), else `unknown` (never checked).
   */
  private computeCertStatus(r: SiteDomainRow): { certStatus: CertStatus; daysToExpiry: number | null } {
    if (r.tlsExpiresAt) {
      const ms = r.tlsExpiresAt.getTime() - Date.now();
      const days = Math.floor(ms / 86_400_000);
      if (ms <= 0) return { certStatus: "expired", daysToExpiry: days };
      if (days < EXPIRING_SOON_DAYS) return { certStatus: "expiring-soon", daysToExpiry: days };
      return { certStatus: "ok", daysToExpiry: days };
    }
    if (r.tlsCheckError && r.tlsCheckedAt) return { certStatus: "error", daysToExpiry: null };
    return { certStatus: "unknown", daysToExpiry: null };
  }

  async get(id: string): Promise<SiteDomainRow> {
    const [row] = await this.repo.db
      .select()
      .from(siteDomains)
      .where(this.repo.scope(siteDomains, eq(siteDomains.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Domain not found");
    return row;
  }

  async create(
    dto: CreateDomainDto,
    actor: AuthUser,
  ): Promise<{ domain: SiteDomainRow; instructions: DnsInstructions }> {
    await this.assertFree(dto.domain);
    const token = randomBytes(24).toString("base64url");
    const [row] = await this.repo.db
      .insert(siteDomains)
      .values({
        ...this.repo.insertDefaults(),
        domain: dto.domain,
        verificationToken: token,
        verificationMethod: "dns-txt",
        status: "pending",
        tlsStatus: "none",
      })
      .returning();
    await this.recordAudit(actor, "domain.added", row.id, { domain: row.domain });
    return { domain: row, instructions: this.buildInstructions(row.domain, row.verificationToken) };
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const existing = await this.get(id);
    await this.repo.db
      .update(siteDomains)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(siteDomains, eq(siteDomains.id, id)));
    // Detach from the site if it was the active custom/primary domain.
    await this.clearSiteDomainIfMatches(existing.domain, actor);
    await this.resolver.invalidate(existing.domain).catch(() => undefined);
    await this.recordAudit(actor, "domain.deleted", id, { domain: existing.domain });
    return { ok: true };
  }

  /**
   * Verify ownership via a real DNS TXT lookup at `_ob-verify.<domain>` for
   * `ob-verify=<token>`. Resilient: any lookup failure flips the row to
   * `failed` with a human reason and never throws a 500.
   */
  async verify(id: string, actor: AuthUser): Promise<VerifyResult> {
    const row = await this.get(id);
    const now = new Date();
    const reason = await this.checkTxt(row.domain, row.verificationToken);

    if (reason) {
      const [failed] = await this.repo.db
        .update(siteDomains)
        .set({ status: "failed", lastCheckedAt: now, updatedBy: actor.userId })
        .where(this.repo.scope(siteDomains, eq(siteDomains.id, id)))
        .returning();
      await this.recordAudit(actor, "domain.verify_failed", id, { domain: row.domain, reason });
      return { domain: failed, verified: false, reason };
    }

    // Verified → kick TLS provisioning (mock in dev).
    let tlsStatus = "pending";
    let tlsDetail = "provisioning";
    try {
      const result = await this.tls.provision(row.domain);
      tlsStatus = result.status;
      tlsDetail = result.detail;
    } catch {
      tlsStatus = "failed";
      tlsDetail = "tls provisioning error";
    }

    const [verified] = await this.repo.db
      .update(siteDomains)
      .set({
        verified: true,
        status: tlsStatus === "issued" ? "active" : "verified",
        verifiedAt: now,
        lastCheckedAt: now,
        tlsStatus,
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(siteDomains, eq(siteDomains.id, id)))
      .returning();
    await this.resolver.invalidate(row.domain).catch(() => undefined);
    await this.recordAudit(actor, "domain.verified", id, { domain: row.domain, tlsStatus, tlsDetail });
    return { domain: verified, verified: true };
  }

  /** Make this (verified) domain the site's primary public host. */
  async setPrimary(id: string, actor: AuthUser): Promise<SiteDomainRow> {
    const row = await this.get(id);
    if (!row.verified) {
      throw new BadRequestException("Verify the domain before making it primary");
    }
    const siteId = this.repo.siteId;
    // Single primary per site: clear the flag everywhere, then set it here.
    await this.repo.db
      .update(siteDomains)
      .set({ isPrimary: false, updatedBy: actor.userId })
      .where(this.repo.scope(siteDomains));
    const [primary] = await this.repo.db
      .update(siteDomains)
      .set({ isPrimary: true, updatedBy: actor.userId })
      .where(this.repo.scope(siteDomains, eq(siteDomains.id, id)))
      .returning();
    // Reflect onto the site row (used by the host resolver fast-path).
    await this.db
      .update(sites)
      .set({ customDomain: row.domain, primaryDomain: row.domain, updatedBy: actor.userId })
      .where(eq(sites.id, siteId));
    await this.resolver.invalidate(row.domain).catch(() => undefined);
    await this.recordAudit(actor, "domain.set_primary", id, { domain: row.domain });
    return primary;
  }

  /**
   * Trigger an on-demand SSL/cert-expiry re-check for one domain (SITE-HEALTH).
   * Enqueues an `ssl-check` job; the worker performs the TLS handshake and
   * writes `tlsExpiresAt`/`tlsCheckedAt`/`tlsCheckError` onto the row. Returns
   * the current (pre-check) view so the UI can optimistically reflect state.
   */
  async sslCheck(id: string, actor: AuthUser): Promise<{ enqueued: boolean; jobId: string | null; domain: DomainView }> {
    const row = await this.get(id);
    const jobId = await this.queue.enqueueSslCheck({ siteId: this.repo.siteId, domainId: id });
    await this.recordAudit(actor, "domain.ssl_check", id, { domain: row.domain, jobId });
    return { enqueued: true, jobId: jobId ?? null, domain: this.toView(row) };
  }

  // -- internals -------------------------------------------------------------

  /** Resolve the verification TXT; return null on success or a reason string. */
  private async checkTxt(domain: string, token: string): Promise<string | null> {
    const host = `${VERIFY_PREFIX}.${domain}`;
    const expected = `${VERIFY_VALUE_PREFIX}${token}`;
    try {
      const records = await dns.resolveTxt(host);
      // resolveTxt returns string[][] (TXT chunks); join each record's chunks.
      const flat = records.map((chunks) => chunks.join(""));
      if (flat.includes(expected)) return null;
      return `TXT record ${host} found but did not contain ${expected}`;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "ENOTFOUND" || code === "ENODATA") {
        return `No TXT record found at ${host}. Add it and try again.`;
      }
      return `DNS lookup for ${host} failed (${code ?? "unknown error"})`;
    }
  }

  private async assertFree(domain: string): Promise<void> {
    // Global uniqueness (anti-takeover): a domain may belong to one site only.
    const [existing] = await this.db
      .select({ id: siteDomains.id })
      .from(siteDomains)
      .where(eq(siteDomains.domain, domain))
      .limit(1);
    if (existing) throw new ConflictException("That domain is already registered");
  }

  private async clearSiteDomainIfMatches(domain: string, actor: AuthUser): Promise<void> {
    const siteId = this.repo.siteId;
    const [site] = await this.db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) return;
    if (site.customDomain === domain || site.primaryDomain === domain) {
      await this.db
        .update(sites)
        .set({
          customDomain: site.customDomain === domain ? null : site.customDomain,
          primaryDomain: site.primaryDomain === domain ? null : site.primaryDomain,
          updatedBy: actor.userId,
        })
        .where(eq(sites.id, siteId));
    }
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
      category: "settings",
      entityType: "domain",
      entityId,
      metadata,
    });
  }
}

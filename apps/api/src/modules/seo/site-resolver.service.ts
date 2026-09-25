import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, or } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { siteDomains, sites, type SiteRow } from "@database/schema";
import { RedisService } from "@modules/redis/redis.service";

const CACHE_TTL_SECONDS = 300;
const CACHE_PREFIX = "host2site:";

/**
 * Host → site resolution for PUBLIC, host-based routes (sitemap/robots, later
 * the renderer). Maps the request Host header to a site via its subdomain, the
 * `custom_domain`/`primary_domain` columns, or a verified `site_domains` row.
 * Results are cached in Redis (negative results too, to avoid hammering the DB).
 */
@Injectable()
export class SiteResolver {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly redis: RedisService,
  ) {}

  /** Normalize a Host header → bare hostname (drop port, lowercase). */
  static normalizeHost(host: string | undefined): string {
    if (!host) return "";
    return host.split(",")[0].trim().split(":")[0].toLowerCase();
  }

  /** Resolve a host to a published-capable site, or null. Cached. */
  async resolve(rawHost: string | undefined): Promise<SiteRow | null> {
    const host = SiteResolver.normalizeHost(rawHost);
    if (!host) return null;

    const cacheKey = `${CACHE_PREFIX}${host}`;
    const cached = await this.safeGet(cacheKey);
    if (cached === "__none__") return null;
    if (cached) {
      const site = await this.loadSite(cached);
      if (site) return site;
    }

    const site = await this.lookup(host);
    await this.safeSet(cacheKey, site ? site.id : "__none__");
    return site;
  }

  private async lookup(host: string): Promise<SiteRow | null> {
    // 1. custom/primary domain exact match.
    const [byDomain] = await this.db
      .select()
      .from(sites)
      .where(
        and(
          or(eq(sites.customDomain, host), eq(sites.primaryDomain, host)),
          isNull(sites.deletedAt),
        ),
      )
      .limit(1);
    if (byDomain) return byDomain;

    // 2. verified site_domains entry.
    const [dom] = await this.db
      .select({ siteId: siteDomains.siteId })
      .from(siteDomains)
      .where(and(eq(siteDomains.domain, host), eq(siteDomains.verified, true), isNull(siteDomains.deletedAt)))
      .limit(1);
    if (dom) {
      const site = await this.loadSite(dom.siteId);
      if (site) return site;
    }

    // 3. subdomain (left-most label of a *.platform host).
    const label = host.split(".")[0];
    if (label) {
      const [bySub] = await this.db
        .select()
        .from(sites)
        .where(and(eq(sites.subdomain, label), isNull(sites.deletedAt)))
        .limit(1);
      if (bySub) return bySub;
    }
    return null;
  }

  private async loadSite(id: string): Promise<SiteRow | null> {
    const [site] = await this.db
      .select()
      .from(sites)
      .where(and(eq(sites.id, id), isNull(sites.deletedAt)))
      .limit(1);
    return site ?? null;
  }

  async invalidate(host: string): Promise<void> {
    await this.safeDel(`${CACHE_PREFIX}${SiteResolver.normalizeHost(host)}`);
  }

  // Redis is best-effort; a cache outage must not break public routes.
  private async safeGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }
  private async safeSet(key: string, value: string): Promise<void> {
    try {
      await this.redis.set(key, value, CACHE_TTL_SECONDS);
    } catch {
      /* ignore */
    }
  }
  private async safeDel(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      /* ignore */
    }
  }
}

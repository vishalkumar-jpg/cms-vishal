import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { pages, posts, type SiteRow } from "@database/schema";
import { RedisService } from "@modules/redis/redis.service";
import { SiteResolver } from "./site-resolver.service";

const SITEMAP_TTL_SECONDS = 3600;
const SITEMAP_PREFIX = "sitemap:";

interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

/**
 * Public SEO surface: per-site sitemap.xml + robots.txt. The site is resolved
 * from the request Host (no auth). Sitemap XML is cached in Redis and purged via
 * the debounced `sitemap-rebuild` job emitted on publish.
 */
@Injectable()
export class SeoService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly resolver: SiteResolver,
    private readonly redis: RedisService,
  ) {}

  async sitemap(host: string | undefined): Promise<string> {
    const site = await this.resolver.resolve(host);
    if (!site) throw new NotFoundException("Site not found for host");

    const cacheKey = `${SITEMAP_PREFIX}${site.id}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return cached;
    } catch {
      /* cache optional */
    }

    const xml = await this.buildSitemap(site, host);
    try {
      await this.redis.set(cacheKey, xml, SITEMAP_TTL_SECONDS);
    } catch {
      /* ignore */
    }
    return xml;
  }

  /** Drop the cached sitemap for a site (called by the rebuild worker). */
  async purgeSitemap(siteId: string): Promise<void> {
    try {
      await this.redis.del(`${SITEMAP_PREFIX}${siteId}`);
    } catch {
      /* ignore */
    }
  }

  async robots(host: string | undefined): Promise<string> {
    const site = await this.resolver.resolve(host);
    if (!site) throw new NotFoundException("Site not found for host");
    const base = this.baseUrl(site, host);
    const isPublic = site.visibility === "public";
    const lines = ["User-agent: *"];
    if (isPublic) {
      lines.push("Allow: /");
      lines.push("Disallow: /admin");
    } else {
      // Non-public sites: keep crawlers out entirely.
      lines.push("Disallow: /");
    }
    lines.push(`Sitemap: ${base}/sitemap.xml`);
    return `${lines.join("\n")}\n`;
  }

  private async buildSitemap(site: SiteRow, host: string | undefined): Promise<string> {
    const base = this.baseUrl(site, host);
    const entries: SitemapEntry[] = [];

    const publishedPages = await this.db
      .select({ slug: pages.slug, updatedAt: pages.updatedAt, seo: pages.seo, status: pages.status })
      .from(pages)
      .where(and(eq(pages.siteId, site.id), eq(pages.status, "published"), isNull(pages.deletedAt)));
    for (const p of publishedPages) {
      if (this.isNoindex(p.seo)) continue;
      const path = p.slug === "home" || p.slug === "index" ? "" : `/${p.slug}`;
      entries.push({ loc: `${base}${path}`, lastmod: p.updatedAt.toISOString() });
    }

    const publishedPosts = await this.db
      .select({ slug: posts.slug, updatedAt: posts.updatedAt, seo: posts.seo, status: posts.status })
      .from(posts)
      .where(and(eq(posts.siteId, site.id), eq(posts.status, "published"), isNull(posts.deletedAt)));
    for (const p of publishedPosts) {
      if (this.isNoindex(p.seo)) continue;
      entries.push({ loc: `${base}/blog/${p.slug}`, lastmod: p.updatedAt.toISOString() });
    }

    const urls = entries
      .map((e) => {
        const lastmod = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : "";
        return `  <url>\n    <loc>${this.xmlEscape(e.loc)}</loc>${lastmod}\n  </url>`;
      })
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  }

  private isNoindex(seo: unknown): boolean {
    return Boolean((seo as { noindex?: boolean } | null)?.noindex);
  }

  /** Prefer the site's configured primary domain; else the request host. */
  private baseUrl(site: SiteRow, host: string | undefined): string {
    const domain =
      site.primaryDomain || site.customDomain || SiteResolver.normalizeHost(host) || `${site.subdomain}`;
    return `https://${domain}`;
  }

  private xmlEscape(input: string): string {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

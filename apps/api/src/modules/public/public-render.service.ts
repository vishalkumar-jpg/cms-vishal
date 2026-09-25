import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { verifyPreviewToken } from "@ob-cms/crypto";
import {
  composePageWithHomepageChrome,
  HOMEPAGE_SLUG_CANDIDATES,
  migrate,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  media,
  navigation,
  pages,
  posts,
  postTerms,
  redirects,
  siteSettings,
  themes,
  type SiteRow,
} from "@database/schema";
import { RedisService } from "@modules/redis/redis.service";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import { normalizeLocales } from "@modules/sites/sites.service";

const RENDER_TTL_SECONDS = 300;

/**
 * Public render API (WAVE3b §C) consumed by the Next.js renderer. Every method
 * resolves the site SERVER-SIDE from the Host header (no client siteId) and
 * caches in Redis under `render:<siteId>:<...>`. The publish→cache-purge job
 * clears `render:<siteId>:*` so a publish is reflected immediately.
 *
 * Results return the responseUtils envelope (the renderer unwraps `.data`).
 * Cache is best-effort — an outage degrades to a live DB read, never an error.
 */
@Injectable()
export class PublicRenderService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly resolver: SiteResolver,
    private readonly redis: RedisService,
  ) {}

  /** site + theme tokens + public settings. */
  async site(host: string | undefined): Promise<Record<string, unknown>> {
    const site = await this.requireSite(host);
    return this.cached(`render:${site.id}:site`, async () => {
      const [theme] = await this.db
        .select()
        .from(themes)
        .where(and(eq(themes.siteId, site.id), isNull(themes.deletedAt)))
        .limit(1);
      const [settings] = await this.db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.siteId, site.id))
        .limit(1);
      const locales = normalizeLocales(settings?.defaultLocale, settings?.locales);
      return {
        site: {
          id: site.id,
          name: site.name,
          subdomain: site.subdomain,
          primaryDomain: site.primaryDomain,
          customDomain: site.customDomain,
          visibility: site.visibility,
          // i18n (B13) — the renderer uses these to detect leading-locale path
          // segments and emit hreflang alternates. Single-locale sites get
          // { defaultLocale: "en", locales: ["en"] } and behave exactly as before.
          defaultLocale: locales.defaultLocale,
          locales: locales.locales,
        },
        // Also expose at the TOP level — the renderer's `PublicSite` reads
        // `site.defaultLocale` / `site.locales` here (not under `.site`).
        defaultLocale: locales.defaultLocale,
        locales: locales.locales,
        theme: theme
          ? { preset: theme.preset, tokens: theme.tokens, brand: theme.brand }
          : { preset: "default", tokens: {}, brand: {} },
        settings: settings ? this.publicSettings(settings) : {},
        // Site Settings hub (#32) — published integrations the renderer injects
        // (GA4/GTM/chat ids + admin-authored head/body scripts). Empty when unset.
        integrations: settings ? this.publicIntegrations(settings) : {},
        // PRIVACY & CONSENT — the consent-banner config the renderer's
        // <ConsentManager/> reads to render the banner + GATE the trackers. Null
        // when unset/disabled ⇒ the renderer shows no banner + trackers behave
        // exactly as before (back-compat). Retention config is admin-only (not
        // published — the worker reads it directly from site_settings).
        consent: settings ? this.publicConsent(settings) : null,
        // GLOBAL-CHROME — the site's ONE global header + footer (SerializedLayout
        // or null). The renderer injects header at the top + footer at the bottom
        // of every page; null → injects nothing. Save-on-chrome purges this key.
        chrome: {
          header: settings?.headerLayout ?? null,
          footer: settings?.footerLayout ?? null,
        },
      };
    });
  }

  /**
   * publishedLayout + seo + schemaVersion for the page at `path` in `locale`.
   *
   * i18n (B13) resolution & fallback:
   *   1. Look up the published page for (site, requested-locale, slug).
   *   2. FALLBACK-TO-DEFAULT: if there is no translation in the requested locale
   *      but the slug resolves in the site's default locale, serve that instead
   *      (so a partially-translated site never 404s a known route). Documented in
   *      apps/api/I18N.md.
   *   3. Otherwise 404.
   *
   * The response also carries `locale`, `defaultLocale` and `alternates` — the
   * set of available translations of this logical page with their public paths
   * (default locale has NO prefix; others are `/<locale>/<path>`) — which the
   * renderer turns into <link rel="alternate" hreflang> tags + x-default.
   */
  async page(
    host: string | undefined,
    path: string,
    requestedLocale?: string,
  ): Promise<Record<string, unknown>> {
    const site = await this.requireSite(host);
    const slug = this.pathToSlug(path);
    const [settings] = await this.db
      .select({ defaultLocale: siteSettings.defaultLocale, locales: siteSettings.locales })
      .from(siteSettings)
      .where(eq(siteSettings.siteId, site.id))
      .limit(1);
    const { defaultLocale, locales } = normalizeLocales(
      settings?.defaultLocale,
      settings?.locales,
    );
    const wanted =
      requestedLocale && locales.includes(requestedLocale) ? requestedLocale : defaultLocale;
    const cacheKey = `render:${site.id}:page:${wanted}:${slug}`;
    return this.cached(cacheKey, async () => {
      // Try the requested locale first, then fall back to the default locale.
      let page =
        slug === "home" || this.normalizePath(path) === "/"
          ? await this.findHomepagePublishedPage(site.id, wanted)
          : await this.findPublishedPage(site.id, slug, wanted);
      let servedLocale = wanted;
      if (!page && wanted !== defaultLocale) {
        page =
          slug === "home" || this.normalizePath(path) === "/"
            ? await this.findHomepagePublishedPage(site.id, defaultLocale)
            : await this.findPublishedPage(site.id, slug, defaultLocale);
        servedLocale = defaultLocale;
      }
      if (!page || !page.publishedLayout) throw new NotFoundException("Page not found");

      const homepageLayout = await this.findHomepagePublishedLayout(site.id, servedLocale);
      const rawLayout = page.publishedLayout as SerializedLayout;
      const composedLayout = composePageWithHomepageChrome(
        migrate(rawLayout),
        homepageLayout ? migrate(homepageLayout) : null,
        (page.layoutOptions as Record<string, unknown> | null) ?? null,
        page.slug,
      );

      // Sibling translations of this logical page → hreflang alternates.
      const key = page.translationKey ?? page.id;
      const siblings = await this.db
        .select({ slug: pages.slug, locale: pages.locale })
        .from(pages)
        .where(
          and(
            eq(pages.siteId, site.id),
            eq(pages.translationKey, key),
            eq(pages.status, "published"),
            isNull(pages.deletedAt),
          ),
        );
      const alternates = siblings.map((s) => ({
        locale: s.locale,
        path: this.localePath(s.slug, s.locale, defaultLocale),
      }));

      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        layout: composedLayout,
        seo: page.seo,
        schemaVersion: page.schemaVersion,
        publishedAt: page.publishedAt,
        locale: servedLocale,
        defaultLocale,
        alternates,
      };
    });
  }

  /** Find a published page for (site, slug, locale). i18n helper. */
  private async findPublishedPage(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<typeof pages.$inferSelect | undefined> {
    const [page] = await this.db
      .select()
      .from(pages)
      .where(
        and(
          eq(pages.siteId, siteId),
          eq(pages.slug, slug),
          eq(pages.locale, locale),
          eq(pages.status, "published"),
          isNull(pages.deletedAt),
        ),
      )
      .limit(1);
    return page;
  }

  /**
   * Resolve the site's homepage published page (tries `home`, then `ob-homepage`, etc.).
   */
  private async findHomepagePublishedPage(
    siteId: string,
    locale: string,
  ): Promise<typeof pages.$inferSelect | undefined> {
    for (const slug of HOMEPAGE_SLUG_CANDIDATES) {
      const page = await this.findPublishedPage(siteId, slug, locale);
      if (page?.publishedLayout) return page;
    }
    return undefined;
  }

  /** Resolve the site's homepage published layout (tries `home`, then `ob-homepage`). */
  private async findHomepagePublishedLayout(
    siteId: string,
    locale: string,
  ): Promise<SerializedLayout | null> {
    const page = await this.findHomepagePublishedPage(siteId, locale);
    return page?.publishedLayout ? (page.publishedLayout as SerializedLayout) : null;
  }

  /** Resolve the site's homepage draft layout for preview composition. */
  private async findHomepageDraftLayout(
    siteId: string,
    locale: string,
  ): Promise<SerializedLayout | null> {
    for (const slug of HOMEPAGE_SLUG_CANDIDATES) {
      const [page] = await this.db
        .select()
        .from(pages)
        .where(
          and(
            eq(pages.siteId, siteId),
            eq(pages.slug, slug),
            eq(pages.locale, locale),
            isNull(pages.deletedAt),
          ),
        )
        .limit(1);
      const layout = page?.draftLayout ?? page?.publishedLayout;
      if (layout) return layout as SerializedLayout;
    }
    return null;
  }

  /** Find a published post for (site, slug, locale). i18n helper. */
  private async findPublishedPost(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<typeof posts.$inferSelect | undefined> {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.siteId, siteId),
          eq(posts.slug, slug),
          eq(posts.locale, locale),
          eq(posts.status, "published"),
          isNull(posts.deletedAt),
        ),
      )
      .limit(1);
    return post;
  }

  /**
   * Build a public path for (slug, locale): the default locale has NO prefix
   * (`/about`, `/` for home), other locales are prefixed (`/es/about`, `/es`).
   */
  private localePath(slug: string, locale: string, defaultLocale: string): string {
    const base = slug === "home" ? "" : `/${slug}`;
    if (locale === defaultLocale) return base || "/";
    return `/${locale}${base}`;
  }

  /**
   * Published-post index for the public blog. Optional `term` slug filter
   * (matches category OR tag). Returns lightweight cards (no layout body).
   */
  async posts(
    host: string | undefined,
    term: string | undefined,
    limit: number,
  ): Promise<Array<Record<string, unknown>>> {
    const site = await this.requireSite(host);
    const max = Math.min(Math.max(limit || 24, 1), 100);
    // i18n (B13): the public blog index lists the DEFAULT locale's posts only, so
    // a multi-locale site doesn't show every translation as a separate card.
    const [settings] = await this.db
      .select({ defaultLocale: siteSettings.defaultLocale, locales: siteSettings.locales })
      .from(siteSettings)
      .where(eq(siteSettings.siteId, site.id))
      .limit(1);
    const { defaultLocale } = normalizeLocales(settings?.defaultLocale, settings?.locales);
    const key = `render:${site.id}:posts:${defaultLocale}:${term ?? "_"}:${max}`;
    return this.cached(key, async () => {
      const where = [
        eq(posts.siteId, site.id),
        eq(posts.locale, defaultLocale),
        eq(posts.status, "published"),
        isNull(posts.deletedAt),
      ];
      if (term) {
        const termRows = await this.db
          .select({ postId: postTerms.postId })
          .from(postTerms)
          .where(and(eq(postTerms.siteId, site.id), eq(postTerms.slug, term)));
        const ids = termRows.map((r) => r.postId).filter((v): v is string => !!v);
        if (ids.length === 0) return [];
        where.push(inArray(posts.id, ids));
      }
      const rows = await this.db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          excerpt: posts.excerpt,
          coverMediaId: posts.coverMediaId,
          coverUrl: media.url,
          publishedAt: posts.publishedAt,
        })
        .from(posts)
        .leftJoin(media, eq(media.id, posts.coverMediaId))
        .where(and(...where))
        .orderBy(desc(posts.publishedAt))
        .limit(max);
      return rows;
    });
  }

  /**
   * A single published post (with its layout body) by slug, or 404. i18n: an
   * optional `locale` resolves the post in that locale, falling back to the
   * site default locale when the translation is missing (same policy as pages).
   */
  async post(
    host: string | undefined,
    slug: string,
    requestedLocale?: string,
  ): Promise<Record<string, unknown>> {
    const site = await this.requireSite(host);
    const [settings] = await this.db
      .select({ defaultLocale: siteSettings.defaultLocale, locales: siteSettings.locales })
      .from(siteSettings)
      .where(eq(siteSettings.siteId, site.id))
      .limit(1);
    const { defaultLocale, locales } = normalizeLocales(
      settings?.defaultLocale,
      settings?.locales,
    );
    const wanted =
      requestedLocale && locales.includes(requestedLocale) ? requestedLocale : defaultLocale;
    return this.cached(`render:${site.id}:post:${wanted}:${slug}`, async () => {
      let post = await this.findPublishedPost(site.id, slug, wanted);
      if (!post && wanted !== defaultLocale) {
        post = await this.findPublishedPost(site.id, slug, defaultLocale);
      }
      if (!post || !post.layout) throw new NotFoundException("Post not found");
      const terms = await this.db
        .select({ kind: postTerms.kind, name: postTerms.name, slug: postTerms.slug })
        .from(postTerms)
        .where(and(eq(postTerms.siteId, site.id), eq(postTerms.postId, post.id)));
      let coverUrl: string | null = null;
      if (post.coverMediaId) {
        const [m] = await this.db
          .select({ url: media.url })
          .from(media)
          .where(eq(media.id, post.coverMediaId))
          .limit(1);
        coverUrl = m?.url ?? null;
      }
      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        layout: post.layout,
        seo: post.seo,
        coverMediaId: post.coverMediaId,
        coverUrl,
        publishedAt: post.publishedAt,
        terms,
      };
    });
  }

  /**
   * CONTENT-OPS — token-gated DRAFT preview of a page. Host-resolved + site-scoped
   * (the entity must belong to the resolved site) and NOT cached. Validates the
   * capability token against the row's `previewToken` nonce; a wrong/missing token
   * or a revoked (null) nonce → 403. Returns the DRAFT layout (falling back to the
   * published layout only if there's no draft) so unpublished edits are visible.
   */
  async previewPage(
    host: string | undefined,
    id: string,
    token: string | undefined,
  ): Promise<Record<string, unknown>> {
    const site = await this.requireSite(host);
    const [page] = await this.db
      .select()
      .from(pages)
      .where(and(eq(pages.siteId, site.id), eq(pages.id, id), isNull(pages.deletedAt)))
      .limit(1);
    if (!page) throw new NotFoundException("Page not found");
    if (!verifyPreviewToken("page", id, page.previewToken, token)) {
      throw new ForbiddenException("Invalid or revoked preview token");
    }
    const layout = page.draftLayout ?? page.publishedLayout;
    if (!layout) throw new NotFoundException("Page has no layout to preview");
    const homepageLayout = await this.findHomepageDraftLayout(site.id, page.locale);
    const composedLayout = composePageWithHomepageChrome(
      migrate(layout as SerializedLayout),
      homepageLayout ? migrate(homepageLayout) : null,
      (page.layoutOptions as Record<string, unknown> | null) ?? null,
      page.slug,
    );
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      layout: composedLayout,
      seo: page.seo,
      schemaVersion: page.schemaVersion,
      locale: page.locale,
      preview: true,
    };
  }

  /** CONTENT-OPS — token-gated DRAFT preview of a blog post (mirrors previewPage). */
  async previewPost(
    host: string | undefined,
    id: string,
    token: string | undefined,
  ): Promise<Record<string, unknown>> {
    const site = await this.requireSite(host);
    const [post] = await this.db
      .select()
      .from(posts)
      .where(and(eq(posts.siteId, site.id), eq(posts.id, id), isNull(posts.deletedAt)))
      .limit(1);
    if (!post) throw new NotFoundException("Post not found");
    if (!verifyPreviewToken("post", id, post.previewToken, token)) {
      throw new ForbiddenException("Invalid or revoked preview token");
    }
    if (!post.layout) throw new NotFoundException("Post has no body to preview");
    let coverUrl: string | null = null;
    if (post.coverMediaId) {
      const [m] = await this.db
        .select({ url: media.url })
        .from(media)
        .where(eq(media.id, post.coverMediaId))
        .limit(1);
      coverUrl = m?.url ?? null;
    }
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      layout: post.layout,
      seo: post.seo,
      coverMediaId: post.coverMediaId,
      coverUrl,
      locale: post.locale,
      preview: true,
    };
  }

  /** header/footer (and any other) navigation trees. */
  async navigation(host: string | undefined): Promise<Record<string, unknown>> {
    const site = await this.requireSite(host);
    return this.cached(`render:${site.id}:nav`, async () => {
      const rows = await this.db
        .select()
        .from(navigation)
        .where(and(eq(navigation.siteId, site.id), isNull(navigation.deletedAt)));
      const trees: Record<string, unknown> = {};
      for (const row of rows) trees[row.location] = row.tree;
      return trees;
    });
  }

  /** Redirect lookup for a path → { to, status } or null. */
  async redirect(
    host: string | undefined,
    path: string,
  ): Promise<{ to: string; status: number } | null> {
    const site = await this.requireSite(host);
    const from = this.normalizePath(path);
    const cacheKey = `render:${site.id}:redirect:${from}`;
    const cached = await this.safeGet(cacheKey);
    if (cached === "__none__") return null;
    if (cached) {
      try {
        return JSON.parse(cached) as { to: string; status: number };
      } catch {
        /* fall through to DB */
      }
    }
    const [row] = await this.db
      .select({ toPath: redirects.toPath, statusCode: redirects.statusCode })
      .from(redirects)
      .where(
        and(eq(redirects.siteId, site.id), eq(redirects.fromPath, from), isNull(redirects.deletedAt)),
      )
      .limit(1);
    const result = row ? { to: row.toPath, status: row.statusCode } : null;
    await this.safeSet(cacheKey, result ? JSON.stringify(result) : "__none__");
    return result;
  }

  // -- helpers ---------------------------------------------------------------

  private async requireSite(host: string | undefined): Promise<SiteRow> {
    const site = await this.resolver.resolve(host);
    if (!site) throw new NotFoundException("Site not found for host");
    return site;
  }

  private pathToSlug(path: string): string {
    const p = this.normalizePath(path);
    if (p === "/" || p === "") return "home";
    return p.replace(/^\/+/, "").replace(/\/+$/, "");
  }

  private normalizePath(path: string | undefined): string {
    const p = (path ?? "/").trim();
    if (!p.startsWith("/")) return `/${p}`;
    return p;
  }

  private publicSettings(s: Record<string, unknown>): Record<string, unknown> {
    // Expose presentational settings only — NEVER the CRM secret/url.
    return {
      tagline: s.tagline,
      logoUrl: s.logoUrl,
      faviconUrl: s.faviconUrl,
      primaryColor: s.primaryColor,
      accentColor: s.accentColor,
      headingFont: s.headingFont,
      bodyFont: s.bodyFont,
      defaultOgImageUrl: s.defaultOgImageUrl,
      contactEmail: s.contactEmail,
      contactPhone: s.contactPhone,
      contactAddress: s.contactAddress,
      socialLinkedin: s.socialLinkedin,
      socialTwitter: s.socialTwitter,
      socialFacebook: s.socialFacebook,
      socialInstagram: s.socialInstagram,
      ga4TrackingId: s.ga4TrackingId,
      tawkToId: s.tawkToId,
    };
  }

  /**
   * Published integrations exposed to the renderer (Site Settings hub #32).
   * Reads the `integrations` jsonb with a fallback to the legacy GA4/chat
   * columns so older sites keep working. Returns only what's set.
   */
  private publicIntegrations(s: Record<string, unknown>): Record<string, unknown> {
    const cfg = (s.integrations as Record<string, unknown> | null) ?? {};
    const out: Record<string, unknown> = {};
    const ga4 = (cfg.ga4MeasurementId as string | undefined) ?? (s.ga4TrackingId as string | undefined);
    const chat = (cfg.liveChatId as string | undefined) ?? (s.tawkToId as string | undefined);
    if (ga4) out.ga4MeasurementId = ga4;
    if (cfg.gtmId) out.gtmId = cfg.gtmId;
    if (chat) out.liveChatId = chat;
    if (cfg.headScripts) out.headScripts = cfg.headScripts;
    if (cfg.bodyScripts) out.bodyScripts = cfg.bodyScripts;
    return out;
  }

  /**
   * Published consent-banner config (Privacy & Consent). Returns `null` when the
   * banner is disabled/unset so the renderer shows nothing and keeps the trackers
   * firing (legacy behaviour). Only presentational config is exposed.
   */
  private publicConsent(s: Record<string, unknown>): Record<string, unknown> | null {
    const cfg = (s.consent as Record<string, unknown> | null) ?? null;
    if (!cfg || cfg.enabled !== true) return null;
    return {
      enabled: true,
      mode: cfg.mode ?? "all",
      position: cfg.position ?? "bottom",
      policyVersion: cfg.policyVersion ?? "1",
      policyUrl: cfg.policyUrl ?? undefined,
      title: cfg.title ?? undefined,
      message: cfg.message ?? undefined,
      analyticsDescription: cfg.analyticsDescription ?? undefined,
      marketingDescription: cfg.marketingDescription ?? undefined,
      accentColor: cfg.accentColor ?? undefined,
    };
  }

  /** Read-through Redis cache for JSON values. Cache is best-effort. */
  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = await this.safeGet(key);
    if (hit) {
      try {
        return JSON.parse(hit) as T;
      } catch {
        /* fall through */
      }
    }
    const value = await load();
    await this.safeSet(key, JSON.stringify(value));
    return value;
  }

  private async safeGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }
  private async safeSet(key: string, value: string): Promise<void> {
    try {
      await this.redis.set(key, value, RENDER_TTL_SECONDS);
    } catch {
      /* ignore */
    }
  }
}

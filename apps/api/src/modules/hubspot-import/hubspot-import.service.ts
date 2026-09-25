import { BadRequestException, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
  assertHubspotImportTokenAllowed,
  CURRENT_SCHEMA_VERSION,
  emptyLayout,
  filterHubspotPreviewByScope,
  HUBSPOT_CONTENT_KIND_BLOG_POST,
  HubspotApiError,
  type HubspotContentKind,
  hubspotBlogPostGetPath,
  hubspotBlogPostListPath,
  hubspotFetchAllPages,
  hubspotFetchPage,
  hubspotListAll,
  EMBED_BLOCK,
  extractHubspotUniversalPage,
  hubspotScopedImportFromUpm,
  hubspotScopedImportFromSource,
  isHubspotPreviewItemPublished,
  sanitizeText,
  type HubspotExtractionDiagnostic,
  toHubspotPreviewItem,
  type HubspotImportScope,
  type HubspotPageKind,
  type HubspotPreviewItem as HubspotInventoryPage,
  type HubspotRawContent,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type {
  ImportRunItemStatus,
  ImportRunObEntityType,
} from "@database/schema/import-run-items.schema";
import { pages, posts, type PageRow, type PostRow } from "@database/schema";
import { ImportRunsService } from "@modules/connectors/import-runs.service";
import { PagesService } from "@modules/pages/pages.service";
import { BlogService } from "@modules/blog/blog.service";
import type {
  HubspotExportItemDto,
  HubspotRunDto,
  HubspotRunExportDto,
} from "./dto/hubspot-import.dto";
import { HubspotAssetMigrationService } from "./hubspot-asset-migration.service";

const HUBSPOT_BASE = "https://api.hubapi.com";

/** A normalized item shown in the preview picker. */
export interface HubspotPreviewItem {
  hsId: string;
  name: string;
  slug: string;
  updatedAt: string;
}

export interface HubspotPreview {
  pages: HubspotPreviewItem[];
  posts: HubspotPreviewItem[];
}

export interface ImportSummary {
  importedPages: number;
  importedPosts: number;
  updatedPages?: number;
  updatedPosts?: number;
  skipped: { name: string; reason: string }[];
}

export interface HubspotScopedImportPreview {
  scope: HubspotImportScope;
  pages: {
    total: number;
    published: number;
    unpublished: number;
    toImport: number;
  };
  posts: {
    total: number;
    published: number;
    unpublished: number;
    toImport: number;
  };
}

/** A normalized item ready to map into OB-CMS. */
interface NormalizedContent {
  name: string;
  slug?: string;
  html: string;
  metaDescription?: string;
  htmlTitle?: string;
  publishState?: string;
  layout?: SerializedLayout;
  hasStructuralLayout?: boolean;
  conversionDiagnostics?: HubspotExtractionDiagnostic[];
}

/** Connection-scoped import context (connectors orchestration). */
export interface HubspotScopedImportContext {
  connectionId: string;
  runId?: string;
}

interface HubspotImportContentOptions {
  applyHubspotPublishState?: boolean;
}

/**
 * HubSpot migration (backlog #28). Pulls a tenant's existing HubSpot CMS pages +
 * blog posts and imports them into OB-CMS with each imported HTML body wrapped
 * in an Embed block inside a SerializedLayout. Connection-scoped imports map
 * HubSpot published content to OB published via PagesService/BlogService.publish;
 * legacy token/export paths create drafts only. The private-app token is accepted
 * per request and never persisted on legacy routes (connectors store credentials).
 *
 * Page/post creation is delegated to PagesService/BlogService so the import
 * mirrors the normal create path (validation, audit, slug rules); slug
 * collisions are resolved by suffixing rather than failing the whole import.
 */
@Injectable()
export class HubspotImportService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly pages: PagesService,
    private readonly blog: BlogService,
    private readonly importRuns: ImportRunsService,
    private readonly assetMigration: HubspotAssetMigrationService,
  ) {}

  // -- preview ---------------------------------------------------------------

  async preview(token: string): Promise<HubspotPreview> {
    await this.enforceHubspotPortalAllowlist(token);
    const [pages, posts] = await Promise.all([
      this.hubspotGet<HubspotListResponse>(token, "/cms/v3/pages"),
      this.hubspotGet<HubspotListResponse>(token, "/cms/v3/blogs/posts"),
    ]);
    return {
      pages: (pages.results ?? []).map(this.toPreviewItem),
      posts: (posts.results ?? []).map(this.toPreviewItem),
    };
  }

  /** Connection-scoped import preview with published vs all filtering. */
  async previewScoped(
    token: string,
    scope: HubspotImportScope,
  ): Promise<HubspotScopedImportPreview> {
    await this.enforceHubspotPortalAllowlist(token);
    const inventory = await this.fetchPreviewInventory(token);
    return {
      scope,
      pages: this.summarizeInventory(inventory.pages, scope),
      posts: this.summarizeInventory(inventory.posts, scope),
    };
  }

  /** Import all HubSpot pages/posts matching scope using stored connection credentials. */
  async runScoped(
    token: string,
    scope: HubspotImportScope,
    actor: AuthUser,
    context: HubspotScopedImportContext,
  ): Promise<ImportSummary> {
    await this.enforceHubspotPortalAllowlist(token);
    const inventory = await this.fetchPreviewInventory(token);
    const pageItems = filterHubspotPreviewByScope(inventory.pages, scope);
    const postIds = filterHubspotPreviewByScope(inventory.posts, scope).map((item) => item.hsId);
    return this.runScopedImport(token, pageItems, postIds, actor, scope, context);
  }

  // -- live run --------------------------------------------------------------

  async run(dto: HubspotRunDto, actor: AuthUser): Promise<ImportSummary> {
    await this.enforceHubspotPortalAllowlist(dto.token);
    const summary: ImportSummary = { importedPages: 0, importedPosts: 0, skipped: [] };

    for (const id of dto.pageIds) {
      try {
        const raw = await this.hubspotGet<HubspotContent>(dto.token, `/cms/v3/pages/${id}`);
        await this.importPage(this.normalize(raw), actor);
        summary.importedPages += 1;
      } catch (err) {
        summary.skipped.push({ name: `page:${id}`, reason: (err as Error).message });
      }
    }

    for (const id of dto.postIds) {
      try {
        const raw = await this.hubspotGet<HubspotContent>(dto.token, `/cms/v3/blogs/posts/${id}`);
        await this.importPost(this.normalize(raw), actor);
        summary.importedPosts += 1;
      } catch (err) {
        summary.skipped.push({ name: `post:${id}`, reason: (err as Error).message });
      }
    }

    await this.recordAudit(actor, "hubspot.imported", {
      mode: "live",
      pages: summary.importedPages,
      posts: summary.importedPosts,
      skipped: summary.skipped.length,
    });
    return summary;
  }

  /** Import pages/posts selected from scoped inventory (site-pages / landing-pages aware). */
  private async runScopedImport(
    token: string,
    pageInventory: HubspotInventoryPage[],
    postIds: string[],
    actor: AuthUser,
    scope: HubspotImportScope,
    context: HubspotScopedImportContext,
  ): Promise<ImportSummary> {
    const summary: ImportSummary = {
      importedPages: 0,
      importedPosts: 0,
      updatedPages: 0,
      updatedPosts: 0,
      skipped: [],
    };
    const scopedImportOptions: HubspotImportContentOptions = { applyHubspotPublishState: true };
    const conversionItems: {
      hubspotHsId: string;
      hubspotKind: string;
      hasStructuralLayout: boolean;
      diagnostics: HubspotExtractionDiagnostic[];
    }[] = [];

    for (const page of pageInventory) {
      const hubspotKind = resolveHubspotPageKind(page.kind);
      const itemLabel = `page:${page.hsId}`;
      try {
        const fetchKind = hubspotPageKindForDetailFetch(page.kind);
        const { raw } = await hubspotFetchPage(token, page.hsId, fetchKind);
        const normalized = await this.normalizedContentFromHubspotRaw(
          raw,
          hubspotKind,
          page.hsId,
          token,
          context,
          actor,
        );
        const result = await this.importScopedPage(
          normalized,
          actor,
          context.connectionId,
          hubspotKind,
          page.hsId,
          scopedImportOptions,
        );
        if (result.created) summary.importedPages += 1;
        else summary.updatedPages = (summary.updatedPages ?? 0) + 1;
        conversionItems.push({
          hubspotHsId: page.hsId,
          hubspotKind,
          hasStructuralLayout: normalized.hasStructuralLayout ?? false,
          diagnostics: normalized.conversionDiagnostics ?? [],
        });
        await this.recordScopedRunItem(context, actor, {
          hubspotHsId: page.hsId,
          hubspotKind,
          status: "succeeded",
          obEntityType: "page",
          obEntityId: result.pageId,
        });
      } catch (err) {
        const reason = hubspotScopedPageImportSkipReason(err, page);
        summary.skipped.push({ name: itemLabel, reason });
        await this.recordScopedRunItem(context, actor, {
          hubspotHsId: page.hsId,
          hubspotKind,
          status: "skipped",
          error: reason,
        });
      }
    }

    for (const id of postIds) {
      const hubspotKind = HUBSPOT_CONTENT_KIND_BLOG_POST;
      const itemLabel = `post:${id}`;
      try {
        const raw = await this.hubspotGet<HubspotRawContent>(token, hubspotBlogPostGetPath(id));
        const normalized = await this.normalizedContentFromHubspotRaw(
          raw,
          HUBSPOT_CONTENT_KIND_BLOG_POST,
          id,
          token,
          context,
          actor,
        );
        const result = await this.importScopedPost(
          normalized,
          actor,
          context.connectionId,
          id,
          scopedImportOptions,
        );
        if (result.created) summary.importedPosts += 1;
        else summary.updatedPosts = (summary.updatedPosts ?? 0) + 1;
        conversionItems.push({
          hubspotHsId: id,
          hubspotKind,
          hasStructuralLayout: normalized.hasStructuralLayout ?? false,
          diagnostics: normalized.conversionDiagnostics ?? [],
        });
        await this.recordScopedRunItem(context, actor, {
          hubspotHsId: id,
          hubspotKind,
          status: "succeeded",
          obEntityType: "post",
          obEntityId: result.postId,
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : "HubSpot post import failed.";
        summary.skipped.push({ name: itemLabel, reason });
        await this.recordScopedRunItem(context, actor, {
          hubspotHsId: id,
          hubspotKind,
          status: "skipped",
          error: reason,
        });
      }
    }

    await this.recordAudit(actor, "hubspot.imported", {
      mode: "connection-scoped",
      scope,
      connectionId: context.connectionId,
      pages: summary.importedPages,
      posts: summary.importedPosts,
      updatedPages: summary.updatedPages,
      updatedPosts: summary.updatedPosts,
      skipped: summary.skipped.length,
      conversionItems,
    });
    return summary;
  }

  private async recordScopedRunItem(
    context: HubspotScopedImportContext,
    actor: AuthUser,
    item: {
      hubspotHsId: string;
      hubspotKind: string;
      status: ImportRunItemStatus;
      obEntityType?: ImportRunObEntityType;
      obEntityId?: string;
      error?: string;
    },
  ): Promise<void> {
    if (!context.runId) return;
    await this.importRuns.recordRunItem({
      runId: context.runId,
      actor,
      ...item,
    });
  }

  private async importScopedPage(
    item: NormalizedContent,
    actor: AuthUser,
    connectionId: string,
    hubspotKind: HubspotPageKind,
    hsId: string,
    options: HubspotImportContentOptions,
  ): Promise<{ pageId: string; created: boolean }> {
    const existing = await this.findImportedPage(connectionId, hubspotKind, hsId);
    if (existing) {
      await this.updateImportedPage(existing, item, actor, options);
      return { pageId: existing.id, created: false };
    }
    const pageId = await this.createImportedPage(item, actor, connectionId, hubspotKind, hsId, options);
    return { pageId, created: true };
  }

  private async importScopedPost(
    item: NormalizedContent,
    actor: AuthUser,
    connectionId: string,
    hsId: string,
    options: HubspotImportContentOptions,
  ): Promise<{ postId: string; created: boolean }> {
    const existing = await this.findImportedPost(connectionId, hsId);
    if (existing) {
      await this.updateImportedPost(existing, item, actor, options);
      return { postId: existing.id, created: false };
    }
    const postId = await this.createImportedPost(item, actor, connectionId, hsId, options);
    return { postId, created: true };
  }

  private async findImportedPage(
    connectionId: string,
    hubspotKind: HubspotPageKind,
    hsId: string,
  ): Promise<PageRow | null> {
    const [row] = await this.repo.db
      .select()
      .from(pages)
      .where(
        this.repo.scope(
          pages,
          eq(pages.hubspotConnectionId, connectionId),
          eq(pages.hubspotKind, hubspotKind),
          eq(pages.hubspotHsId, hsId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async findImportedPost(connectionId: string, hsId: string): Promise<PostRow | null> {
    const [row] = await this.repo.db
      .select()
      .from(posts)
      .where(
        this.repo.scope(
          posts,
          eq(posts.hubspotConnectionId, connectionId),
          eq(posts.hubspotKind, HUBSPOT_CONTENT_KIND_BLOG_POST),
          eq(posts.hubspotHsId, hsId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async createImportedPage(
    item: NormalizedContent,
    actor: AuthUser,
    connectionId: string,
    hubspotKind: HubspotPageKind,
    hsId: string,
    options: HubspotImportContentOptions,
  ): Promise<string> {
    const title = sanitizeText(item.name || "Imported page");
    const slug = await this.freePageSlug(item.slug ?? this.slugify(item.name));
    const row = await this.pages.create(
      {
        title,
        slug,
        draftLayout: this.scopedImportLayout(item) as unknown as Record<string, unknown>,
        seo: {
          title: item.htmlTitle ? sanitizeText(item.htmlTitle) : title,
          description: item.metaDescription ? sanitizeText(item.metaDescription) : undefined,
        },
      },
      actor,
      {
        hubspotSourceIdentity: {
          hubspotConnectionId: connectionId,
          hubspotKind,
          hubspotHsId: hsId,
        },
      },
    );
    if (options.applyHubspotPublishState && this.shouldPublishHubspotContent(item.publishState)) {
      await this.pages.publish(row.id, actor);
    }
    return row.id;
  }

  private async createImportedPost(
    item: NormalizedContent,
    actor: AuthUser,
    connectionId: string,
    hsId: string,
    options: HubspotImportContentOptions,
  ): Promise<string> {
    const title = sanitizeText(item.name || "Imported post");
    const slug = await this.freePostSlug(item.slug ?? this.slugify(item.name));
    const row = await this.blog.create(
      {
        title,
        slug,
        layout: this.scopedImportLayout(item) as unknown as Record<string, unknown>,
        seo: {
          title: item.htmlTitle ? sanitizeText(item.htmlTitle) : title,
          description: item.metaDescription ? sanitizeText(item.metaDescription) : undefined,
        },
      },
      actor,
      {
        hubspotSourceIdentity: {
          hubspotConnectionId: connectionId,
          hubspotKind: HUBSPOT_CONTENT_KIND_BLOG_POST,
          hubspotHsId: hsId,
        },
      },
    );
    if (options.applyHubspotPublishState && this.shouldPublishHubspotContent(item.publishState)) {
      await this.blog.publish(row.id, actor);
    }
    return row.id;
  }

  private async updateImportedPage(
    existing: PageRow,
    item: NormalizedContent,
    actor: AuthUser,
    options: HubspotImportContentOptions,
  ): Promise<void> {
    const title = sanitizeText(item.name || "Imported page");
    await this.pages.saveDraft(
      existing.id,
      {
        layout: this.scopedImportLayout(item) as unknown as Record<string, unknown>,
        seo: {
          title: item.htmlTitle ? sanitizeText(item.htmlTitle) : title,
          description: item.metaDescription ? sanitizeText(item.metaDescription) : undefined,
        },
      },
      actor,
    );
    if (title !== existing.title) {
      await this.pages.update(existing.id, { title }, actor);
    }
    if (options.applyHubspotPublishState && this.shouldPublishHubspotContent(item.publishState)) {
      await this.pages.publish(existing.id, actor);
    }
  }

  private async updateImportedPost(
    existing: PostRow,
    item: NormalizedContent,
    actor: AuthUser,
    options: HubspotImportContentOptions,
  ): Promise<void> {
    const title = sanitizeText(item.name || "Imported post");
    await this.blog.update(
      existing.id,
      {
        title,
        layout: this.scopedImportLayout(item) as unknown as Record<string, unknown>,
        seo: {
          title: item.htmlTitle ? sanitizeText(item.htmlTitle) : title,
          description: item.metaDescription ? sanitizeText(item.metaDescription) : undefined,
        },
      },
      actor,
    );
    if (options.applyHubspotPublishState && this.shouldPublishHubspotContent(item.publishState)) {
      await this.blog.publish(existing.id, actor);
    }
  }

  // -- offline export run ----------------------------------------------------

  /**
   * Offline fallback: import from an uploaded HubSpot export JSON array, so the
   * feature is testable without a live token. Items default to pages; an item
   * with `type: "post"` becomes a blog post.
   */
  async runExport(dto: HubspotRunExportDto, actor: AuthUser): Promise<ImportSummary> {
    const summary: ImportSummary = { importedPages: 0, importedPosts: 0, skipped: [] };

    for (const item of dto.items) {
      const normalized: NormalizedContent = {
        name: item.name,
        slug: item.slug,
        html: item.html,
        metaDescription: item.metaDescription,
      };
      try {
        if (item.type === "post") {
          await this.importPost(normalized, actor);
          summary.importedPosts += 1;
        } else {
          await this.importPage(normalized, actor);
          summary.importedPages += 1;
        }
      } catch (err) {
        summary.skipped.push({ name: item.name, reason: (err as Error).message });
      }
    }

    await this.recordAudit(actor, "hubspot.imported", {
      mode: "export",
      pages: summary.importedPages,
      posts: summary.importedPosts,
      skipped: summary.skipped.length,
    });
    return summary;
  }

  // -- mapping ---------------------------------------------------------------

  private async importPage(
    item: NormalizedContent,
    actor: AuthUser,
    options?: HubspotImportContentOptions,
  ): Promise<void> {
    const title = sanitizeText(item.name || "Imported page");
    const slug = await this.freePageSlug(item.slug ?? this.slugify(item.name));
    const row = await this.pages.create(
      {
        title,
        slug,
        draftLayout: this.scopedImportLayout(item) as unknown as Record<string, unknown>,
        seo: {
          title: item.htmlTitle ? sanitizeText(item.htmlTitle) : title,
          description: item.metaDescription ? sanitizeText(item.metaDescription) : undefined,
        },
      },
      actor,
    );
    if (options?.applyHubspotPublishState && this.shouldPublishHubspotContent(item.publishState)) {
      await this.pages.publish(row.id, actor);
    }
  }

  private async importPost(
    item: NormalizedContent,
    actor: AuthUser,
    options?: HubspotImportContentOptions,
  ): Promise<void> {
    const title = sanitizeText(item.name || "Imported post");
    const slug = await this.freePostSlug(item.slug ?? this.slugify(item.name));
    const row = await this.blog.create(
      {
        title,
        slug,
        layout: this.scopedImportLayout(item) as unknown as Record<string, unknown>,
        seo: {
          title: item.htmlTitle ? sanitizeText(item.htmlTitle) : title,
          description: item.metaDescription ? sanitizeText(item.metaDescription) : undefined,
        },
      },
      actor,
    );
    if (options?.applyHubspotPublishState && this.shouldPublishHubspotContent(item.publishState)) {
      await this.blog.publish(row.id, actor);
    }
  }

  private shouldPublishHubspotContent(publishState?: string): boolean {
    return isHubspotPreviewItemPublished({
      hsId: "",
      kind: "page",
      name: "",
      slug: "",
      updatedAt: "",
      publishState,
    });
  }

  /**
   * Build a SerializedLayout whose root Section contains a single Embed node
   * holding the imported HTML. The Embed block sanitizes the HTML at render
   * (allow-listed tags / sandboxed iframes), so raw HubSpot markup is safe.
   */
  private embedLayout(html: string): SerializedLayout {
    const layout = emptyLayout();
    const embedId = "imported-embed";
    layout.nodes[embedId] = {
      type: { resolvedName: EMBED_BLOCK },
      isCanvas: false,
      props: { html: html ?? "" },
      displayName: EMBED_BLOCK,
      custom: {},
      parent: layout.root,
      hidden: false,
      nodes: [],
      linkedNodes: {},
    };
    const root = layout.nodes[layout.root];
    if (root) root.nodes = [embedId];
    layout.schemaVersion = CURRENT_SCHEMA_VERSION;
    return layout;
  }

  // -- HubSpot HTTP ----------------------------------------------------------

  private async enforceHubspotPortalAllowlist(token: string): Promise<void> {
    try {
      await assertHubspotImportTokenAllowed(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "HubSpot portal is not allowed.";
      throw new BadRequestException(message);
    }
  }

  private async hubspotGet<T>(token: string, path: string): Promise<T> {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${HUBSPOT_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    } catch {
      // Network/DNS failure — surface a clean 400, never a 500.
      throw new BadRequestException("Could not reach HubSpot. Check your network and try again.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new BadRequestException("HubSpot rejected the token. Check the private-app token and scopes.");
    }
    if (!res.ok) {
      throw new BadRequestException(`HubSpot request failed (${res.status}).`);
    }
    try {
      return (await res.json()) as T;
    } catch {
      throw new BadRequestException("HubSpot returned an unreadable response.");
    }
  }

  // -- normalization ---------------------------------------------------------

  private toPreviewItem = (r: HubspotContent): HubspotPreviewItem => ({
    hsId: String(r.id ?? ""),
    name: r.name ?? r.htmlTitle ?? "(untitled)",
    slug: r.slug ?? "",
    updatedAt: r.updatedAt ?? r.updated ?? "",
  });

  /** Scoped import: UPM → Phase D layout (embed fallback when no structural layout). */
  private async normalizedContentFromHubspotRaw(
    raw: HubspotRawContent,
    kind: HubspotContentKind,
    hsId: string,
    token: string,
    context: HubspotScopedImportContext,
    actor: AuthUser,
  ): Promise<NormalizedContent> {
    const extractedAtIso = new Date().toISOString();
    const upm = extractHubspotUniversalPage({
      raw: raw as Record<string, unknown>,
      kind,
      hsId,
      extractedAtIso,
    });
    const { urlMap, diagnostics: assetDiagnostics } = await this.assetMigration.migrateUpmAssets(
      context.connectionId,
      upm,
      token,
      actor,
    );
    const bundle = hubspotScopedImportFromUpm(upm, raw, { assetUrlMap: urlMap });
    const content = bundle.normalized;
    return {
      name: content.name,
      slug: content.slug,
      html: content.html,
      metaDescription: content.metaDescription,
      htmlTitle: content.htmlTitle,
      publishState: content.publishState,
      layout: bundle.layout,
      hasStructuralLayout: bundle.hasStructuralLayout,
      conversionDiagnostics: [...bundle.diagnostics, ...assetDiagnostics],
    };
  }

  private scopedImportLayout(item: NormalizedContent): SerializedLayout {
    return item.layout ?? this.embedLayout(item.html);
  }

  private async fetchPreviewInventory(
    token: string,
  ): Promise<{ pages: HubspotInventoryPage[]; posts: HubspotInventoryPage[] }> {
    try {
      const pages = await hubspotFetchAllPages(token);
      const postRaw = await hubspotListAll<HubspotRawContent>(token, hubspotBlogPostListPath());
      const posts = postRaw.map((row) =>
        toHubspotPreviewItem(row, HUBSPOT_CONTENT_KIND_BLOG_POST),
      );
      return { pages, posts };
    } catch (err) {
      if (err instanceof HubspotApiError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  private summarizeInventory(
    items: HubspotInventoryPage[],
    scope: HubspotImportScope,
  ): HubspotScopedImportPreview["pages"] {
    const published = items.filter(isHubspotPreviewItemPublished).length;
    const toImport = filterHubspotPreviewByScope(items, scope).length;
    return {
      total: items.length,
      published,
      unpublished: items.length - published,
      toImport,
    };
  }

  /** Extract the body HTML from the several shapes HubSpot uses for it. */
  private normalize(r: HubspotContent): NormalizedContent {
    const widgetHtml = r.widgetContainers
      ? Object.values(r.widgetContainers)
          .map((w) => (w && typeof w === "object" ? extractWidgetHtml(w) : ""))
          .filter(Boolean)
          .join("\n")
      : "";
    const html = r.postBody ?? r.html ?? r.body ?? widgetHtml ?? "";
    return {
      name: r.name ?? r.htmlTitle ?? "Imported",
      slug: r.slug,
      html,
      metaDescription: r.metaDescription,
      htmlTitle: r.htmlTitle,
    };
  }

  // -- helpers ---------------------------------------------------------------

  private async freePageSlug(base: string): Promise<string> {
    return this.freeSlug(base, (slug) => this.slugTakenInPages(slug));
  }

  private async freePostSlug(base: string): Promise<string> {
    return this.freeSlug(base, (slug) => this.slugTakenInPosts(slug));
  }

  /** Probe-and-suffix until a free slug is found (about → about-1 → about-2). */
  private async freeSlug(
    base: string,
    taken: (slug: string) => Promise<boolean>,
  ): Promise<string> {
    const root = this.slugify(base);
    let candidate = root;
    for (let i = 1; i <= 50; i += 1) {
      if (!(await taken(candidate))) return candidate;
      candidate = `${root}-${i}`.slice(0, 198);
    }
    return `${root}-${Date.now()}`.slice(0, 198);
  }

  private async slugTakenInPages(slug: string): Promise<boolean> {
    const rows = await this.pages.list({});
    return rows.some((p) => p.slug === slug);
  }

  private async slugTakenInPosts(slug: string): Promise<boolean> {
    const rows = await this.blog.list({});
    return rows.some((p) => p.slug === slug);
  }

  private slugify(input: string): string {
    return (
      (input || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 198) || `imported-${Date.now()}`
    );
  }

  private async recordAudit(
    actor: AuthUser,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action,
      category: "content",
      entityType: "hubspot_import",
      entityId: this.repo.siteId,
      metadata,
    });
  }
}

/** A raw HubSpot CMS page / blog-post object (loosely typed — fields vary). */
interface HubspotContent {
  id?: string | number;
  name?: string;
  slug?: string;
  htmlTitle?: string;
  metaDescription?: string;
  updatedAt?: string;
  updated?: string;
  html?: string;
  body?: string;
  postBody?: string;
  widgetContainers?: Record<string, unknown>;
}

interface HubspotListResponse {
  results?: HubspotContent[];
}

const hubspotPageKindForDetailFetch = (
  kind: HubspotContentKind | undefined,
): HubspotPageKind | undefined =>
  kind === "page" || kind === "landing_page" ? kind : undefined;

const resolveHubspotPageKind = (kind: HubspotContentKind | undefined): HubspotPageKind =>
  kind === "landing_page" ? "landing_page" : "page";

const hubspotScopedPageImportSkipReason = (
  err: unknown,
  page: { hsId: string; kind?: HubspotContentKind },
): string => {
  if (err instanceof HubspotApiError) {
    const pathHint =
      page.kind === "landing_page"
        ? "landing-pages"
        : page.kind === "page"
          ? "site-pages"
          : "site-pages|landing-pages";
    return `HubSpot page detail fetch failed (${err.status ?? "error"}) for ${pathHint}/${page.hsId}.`;
  }
  if (err instanceof Error) return err.message;
  return "HubSpot page import failed.";
};

/** HubSpot widget containers nest body HTML a couple of levels deep. */
const extractWidgetHtml = (w: object): string => {
  const obj = w as Record<string, unknown>;
  if (typeof obj.html === "string") return obj.html;
  if (obj.body && typeof obj.body === "object") {
    const body = obj.body as Record<string, unknown>;
    if (typeof body.html === "string") return body.html;
  }
  return "";
};

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { desc, eq, ilike, type SQL } from "drizzle-orm";
import {
  CURRENT_SCHEMA_VERSION,
  deserializeLayout,
  importPocExport,
  sanitizeText,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import { randomBytes } from "node:crypto";
import { isReservedRootSlug } from "@ob-cms/shared";
import { computePreviewToken } from "@ob-cms/crypto";
import {
  pageVersions,
  pages,
  sites,
  siteSettings,
  type PageRow,
  type PageVersionRow,
} from "@database/schema";
import { normalizeLocales } from "@modules/sites/sites.service";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { TenantContext } from "@common/tenancy/tenant-context";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import { RedirectsService } from "@modules/redirects/redirects.service";
import { WebhooksEmitter } from "@modules/webhooks/webhooks-emitter.service";
import { NotificationsService } from "@modules/notifications/notifications.service";
import type {
  ApproveDto,
  CreatePageDto,
  CreateTranslationDto,
  ImportPocDto,
  ListPagesQueryDto,
  PageSeoDto,
  RejectDto,
  SaveDraftDto,
  SchedulePageDto,
  SubmitReviewDto,
  UpdatePageDto,
} from "./dto/page.dto";
import {
  provenanceColumnsFrom,
  type CreatePageOptions,
} from "./page-template-provenance";

interface PageSeo {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

/**
 * Pages — builder-authored content with the draft/publish/version lifecycle
 * (TECH-ARCHITECTURE §2.2). Every query goes through the ScopedRepository so a
 * page can only ever be read/written within its own site. Layout writes are
 * validated/repaired through @ob-cms/block-schema before they hit the DB.
 */
@Injectable()
export class PagesService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly redirects: RedirectsService,
    private readonly ctx: TenantContext,
    private readonly webhooks: WebhooksEmitter,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: ListPagesQueryDto): Promise<PageRow[]> {
    const extra: Array<SQL | undefined> = [];
    if (query.status) extra.push(eq(pages.status, query.status));
    if (query.state) extra.push(eq(pages.workflowState, query.state));
    if (query.assignedTo) {
      const reviewerId = query.assignedTo === "me" ? this.ctx.userId : query.assignedTo;
      // Fail closed: "me" with no authenticated user matches nothing.
      extra.push(eq(pages.reviewerId, reviewerId ?? "__none__"));
    }
    if (query.q) extra.push(ilike(pages.title, `%${query.q}%`));
    // i18n: optionally narrow to one locale's pages. Without a filter the list
    // returns every locale (single-locale sites are unaffected).
    if (query.locale) extra.push(eq(pages.locale, query.locale));
    return this.repo.db
      .select()
      .from(pages)
      .where(this.repo.scope(pages, ...extra))
      .orderBy(desc(pages.updatedAt))
      .limit(500);
  }

  /** The site's locale set (i18n B13). Falls back to single-locale ["en"]. */
  private async siteLocales(): Promise<{ defaultLocale: string; locales: string[] }> {
    const [row] = await this.repo.db
      .select({ defaultLocale: siteSettings.defaultLocale, locales: siteSettings.locales })
      .from(siteSettings)
      .where(eq(siteSettings.siteId, this.repo.siteId))
      .limit(1);
    return normalizeLocales(row?.defaultLocale, row?.locales);
  }

  async get(id: string): Promise<PageRow> {
    const [row] = await this.repo.db
      .select()
      .from(pages)
      .where(this.repo.scope(pages, eq(pages.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Page not found");
    return row;
  }

  /**
   * Create a draft page. Optional `options.provenance` is an internal-only
   * channel used by TemplateInstantiationService — never exposed on CreatePageDto.
   */
  async create(
    dto: CreatePageDto,
    actor: AuthUser,
    options?: CreatePageOptions,
  ): Promise<PageRow> {
    // i18n: new pages are authored in the site's default locale and start their
    // own translation group (translationKey := the new row's id).
    const { defaultLocale } = await this.siteLocales();
    await this.assertRootSlugAllowed(dto.slug, dto.parentId ?? null);
    await this.assertSlugFree(dto.slug, defaultLocale);
    const layout = dto.draftLayout ? this.validateLayout(dto.draftLayout) : null;
    const provenance = options?.provenance;
    const hubspotSource = options?.hubspotSourceIdentity;
    const [row] = await this.repo.db
      .insert(pages)
      .values({
        ...this.repo.insertDefaults(),
        title: sanitizeText(dto.title),
        slug: dto.slug,
        locale: defaultLocale,
        status: "draft",
        draftLayout: layout as unknown,
        seo: this.cleanSeo(dto.seo) as unknown,
        parentId: dto.parentId ?? null,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sourceTemplateId: provenance?.sourceTemplateId ?? null,
        sourceTemplateKey: provenance?.sourceTemplateKey ?? null,
        sourceTemplateVersion: provenance?.sourceTemplateVersion ?? null,
        instantiatedAt: provenance?.instantiatedAt ?? null,
        hubspotConnectionId: hubspotSource?.hubspotConnectionId ?? null,
        hubspotKind: hubspotSource?.hubspotKind ?? null,
        hubspotHsId: hubspotSource?.hubspotHsId ?? null,
      })
      .returning();
    const [withKey] = await this.repo.db
      .update(pages)
      .set({ translationKey: row.id })
      .where(this.repo.scope(pages, eq(pages.id, row.id)))
      .returning();
    await this.recordAudit(actor, "page.created", row.id, { slug: row.slug });
    return withKey ?? row;
  }

  /**
   * Duplicate a page as a NEW draft: copies the working layout (draft, falling
   * back to published), seo, parent, locale, and template provenance; gets its
   * own slug (`<slug>-copy`, `-copy-2`, ... first free) and starts its own
   * translation group. Publish state, schedule, expiry and review state are NOT
   * copied — a duplicate always starts at the top of the lifecycle.
   */
  async duplicate(id: string, actor: AuthUser): Promise<PageRow> {
    const source = await this.get(id);
    const slug = await this.nextCopySlug(source.slug, source.locale);
    const [row] = await this.repo.db
      .insert(pages)
      .values({
        ...this.repo.insertDefaults(),
        title: `${source.title} (copy)`.slice(0, 300),
        slug,
        locale: source.locale,
        status: "draft",
        workflowState: "draft",
        draftLayout: (source.draftLayout ?? source.publishedLayout ?? null) as unknown,
        seo: source.seo as unknown,
        layoutOptions: source.layoutOptions as unknown,
        parentId: source.parentId ?? null,
        schemaVersion: source.schemaVersion,
        ...provenanceColumnsFrom(source),
      })
      .returning();
    const [withKey] = await this.repo.db
      .update(pages)
      .set({ translationKey: row.id })
      .where(this.repo.scope(pages, eq(pages.id, row.id)))
      .returning();
    await this.recordAudit(actor, "page.duplicated", row.id, { sourceId: id, slug });
    return withKey ?? row;
  }

  /** First free `<slug>-copy[-N]` for the locale (bounded; conflicts 409 after). */
  private async nextCopySlug(slug: string, locale: string): Promise<string> {
    // Keep room for the suffix within the 200-char slug cap.
    const stem = `${slug.slice(0, 180)}-copy`;
    for (let n = 0; n < 20; n += 1) {
      const candidate = n === 0 ? stem : `${stem}-${n + 1}`;
      const [taken] = await this.repo.db
        .select({ id: pages.id })
        .from(pages)
        .where(this.repo.scope(pages, eq(pages.slug, candidate), eq(pages.locale, locale)))
        .limit(1);
      if (!taken) return candidate;
    }
    throw new ConflictException("Too many copies of this page — rename one first");
  }

  /**
   * i18n (B13): list the sibling translations of a page (rows sharing its
   * translationKey), including itself. One row per locale.
   */
  async listTranslations(id: string): Promise<PageRow[]> {
    const source = await this.get(id);
    const key = source.translationKey ?? source.id;
    return this.repo.db
      .select()
      .from(pages)
      .where(this.repo.scope(pages, eq(pages.translationKey, key)))
      .orderBy(desc(pages.locale));
  }

  /**
   * i18n (B13): create a translation of a page in another locale. Clones the
   * source's layout/seo as a starting point into a NEW row with the same
   * translationKey, the target locale, its own slug, and status draft. The
   * target locale must be in the site's locale set and must not already exist
   * for this translation group.
   */
  async createTranslation(
    id: string,
    dto: CreateTranslationDto,
    actor: AuthUser,
  ): Promise<PageRow> {
    const source = await this.get(id);
    const { locales } = await this.siteLocales();
    if (!locales.includes(dto.locale)) {
      throw new BadRequestException(
        `Locale '${dto.locale}' is not enabled for this site. Add it in Settings first.`,
      );
    }
    if (dto.locale === source.locale) {
      throw new BadRequestException("Target locale matches the source page's locale");
    }
    const key = source.translationKey ?? source.id;
    const siblings = await this.repo.db
      .select({ id: pages.id, locale: pages.locale })
      .from(pages)
      .where(this.repo.scope(pages, eq(pages.translationKey, key)));
    if (siblings.some((s) => s.locale === dto.locale)) {
      throw new ConflictException(`A '${dto.locale}' translation already exists`);
    }
    const slug = dto.slug ?? source.slug;
    await this.assertRootSlugAllowed(slug, source.parentId ?? null);
    await this.assertSlugFree(slug, dto.locale);
    const [row] = await this.repo.db
      .insert(pages)
      .values({
        ...this.repo.insertDefaults(),
        title: source.title,
        slug,
        locale: dto.locale,
        translationKey: key,
        status: "draft",
        workflowState: "draft",
        // Clone the published-or-draft layout as the starting point.
        draftLayout: (source.draftLayout ?? source.publishedLayout ?? null) as unknown,
        seo: source.seo as unknown,
        layoutOptions: source.layoutOptions as unknown,
        parentId: source.parentId ?? null,
        schemaVersion: source.schemaVersion,
        ...provenanceColumnsFrom(source),
      })
      .returning();
    await this.recordAudit(actor, "page.translation_created", row.id, {
      locale: dto.locale,
      translationKey: key,
      sourceId: source.id,
    });
    return row;
  }

  async update(id: string, dto: UpdatePageDto, actor: AuthUser): Promise<PageRow> {
    const existing = await this.get(id);
    if (dto.slug && dto.slug !== existing.slug) {
      await this.assertSlugFree(dto.slug, existing.locale, id);
    }

    // Auto-301 (gap D22): when a PUBLISHED page's route (slug or parent) changes,
    // capture its OLD public path BEFORE the write so we can redirect old→new.
    const slugOrParentChanged =
      (dto.slug !== undefined && dto.slug !== existing.slug) ||
      (dto.parentId !== undefined && (dto.parentId ?? null) !== (existing.parentId ?? null));
    // A slug OR parent change can move the page to root level — re-check the
    // reserved-namespace guard against the page's EFFECTIVE new (slug, parent).
    if (slugOrParentChanged) {
      await this.assertRootSlugAllowed(
        dto.slug ?? existing.slug,
        dto.parentId !== undefined ? (dto.parentId ?? null) : (existing.parentId ?? null),
      );
    }
    const oldPath =
      existing.status === "published" && slugOrParentChanged
        ? await this.resolvePagePath(existing)
        : null;

    const patch: Partial<PageRow> = { updatedBy: actor.userId };
    if (dto.title !== undefined) patch.title = sanitizeText(dto.title);
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.parentId !== undefined) patch.parentId = dto.parentId;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.seo !== undefined) patch.seo = this.cleanSeo(dto.seo) as unknown;
    // CONTENT-OPS expiry: `expiresAt` may be set (ISO string) or cleared (null).
    if (dto.expiresAt !== undefined) {
      patch.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.layoutOptions !== undefined) {
      patch.layoutOptions = dto.layoutOptions as unknown;
    }
    const [row] = await this.repo.db
      .update(pages)
      .set(patch)
      .where(this.repo.scope(pages, eq(pages.id, id)))
      .returning();
    await this.recordAudit(actor, "page.updated", id, { fields: Object.keys(dto) });

    if (dto.layoutOptions !== undefined && existing.status === "published") {
      await this.queue.enqueueCachePurge({
        siteId: this.repo.siteId,
        entity: "page",
        entityId: id,
        slug: row.slug,
      });
    }

    if (oldPath) {
      const newPath = await this.resolvePagePath(row);
      await this.createSlugChangeRedirect(oldPath, newPath, actor);
    }
    return row;
  }

  /**
   * Resolve a page's public path from its parent chain — mirrors the renderer's
   * `pagePath`/`slugToPath`: `slug === "home"` → "/", otherwise the slash-joined
   * slug chain of the page + its ancestors (a home ancestor contributes nothing).
   * Cycles are guarded. Used to compute old→new redirect paths.
   */
  private async resolvePagePath(page: Pick<PageRow, "id" | "slug" | "parentId">): Promise<string> {
    if (page.slug === "home") return "/";
    const all = await this.repo.db
      .select({ id: pages.id, slug: pages.slug, parentId: pages.parentId })
      .from(pages)
      .where(this.repo.scope(pages));
    const byId = new Map(all.map((p) => [p.id, p]));
    // Ensure the candidate (possibly just-updated) row is the one we walk from.
    byId.set(page.id, { id: page.id, slug: page.slug, parentId: page.parentId });

    const segments: string[] = [];
    const seen = new Set<string>();
    let current: { id: string; slug: string; parentId: string | null } | undefined = {
      id: page.id,
      slug: page.slug,
      parentId: page.parentId,
    };
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.slug === "home") break;
      segments.unshift(current.slug);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return `/${segments.join("/")}`;
  }

  /**
   * Create a 301 from an old page path to its new path after a slug/parent
   * change. Best-effort: loop/duplicate guards live in RedirectsService, so a
   * collision (e.g. a redirect for that path already exists) is swallowed and
   * audited rather than failing the page update.
   */
  private async createSlugChangeRedirect(
    oldPath: string,
    newPath: string,
    actor: AuthUser,
  ): Promise<void> {
    if (!oldPath || !newPath || oldPath === newPath) return;
    try {
      await this.redirects.create({ fromPath: oldPath, toPath: newPath, statusCode: 301 }, actor);
      await this.recordAudit(actor, "page.redirect_created", oldPath, {
        from: oldPath,
        to: newPath,
        reason: "slug_change",
      });
    } catch {
      // A redirect for oldPath may already exist, or it would form a loop. Either
      // way we must not break the slug update — the redirect is a side benefit.
    }
  }

  /**
   * Autosave the draft layout with optimistic concurrency. `ifMatch` is the
   * client's last-seen `updatedAt` ISO string (from the If-Match header). If it
   * no longer matches the row's current `updatedAt` the write is rejected 409 so
   * a stale tab cannot clobber a newer save.
   */
  async saveDraft(
    id: string,
    dto: SaveDraftDto,
    actor: AuthUser,
    ifMatch?: string,
  ): Promise<PageRow> {
    const existing = await this.get(id);
    if (ifMatch && existing.updatedAt.toISOString() !== ifMatch) {
      throw new ConflictException("Page was modified since you last loaded it");
    }
    const layout = this.validateLayout(dto.layout);
    const patch: Partial<PageRow> = { draftLayout: layout as unknown, updatedBy: actor.userId };
    if (dto.seo !== undefined) patch.seo = this.cleanSeo(dto.seo) as unknown;
    const [row] = await this.repo.db
      .update(pages)
      .set(patch)
      .where(this.repo.scope(pages, eq(pages.id, id)))
      .returning();
    await this.recordAudit(actor, "page.draft_saved", id);
    return row;
  }

  /**
   * Publish: copy draftLayout → publishedLayout, snapshot a version, set
   * publishedAt/status, then enqueue cache-purge + a debounced sitemap rebuild.
   */
  async publish(id: string, actor: AuthUser): Promise<PageRow> {
    const existing = await this.get(id);
    // B14 editorial gate: a page sitting in `in_review` must be approved (or
    // rejected) first — it cannot be published out from under the reviewer.
    // Editors/admins reach this handler (@Roles("editor")); they may publish a
    // draft/approved page directly. Only the in_review state is blocked.
    if (existing.workflowState === "in_review") {
      throw new BadRequestException(
        "Page is in review — approve it (or reject) before publishing",
      );
    }
    const layout = existing.draftLayout ?? existing.publishedLayout;
    if (!layout) throw new BadRequestException("Nothing to publish — page has no layout");
    const validated = this.validateLayout(layout as Record<string, unknown>);
    const now = new Date();

    const row = await this.repo.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(pages)
        .set({
          publishedLayout: validated as unknown,
          status: "published",
          workflowState: "published",
          publishedAt: now,
          scheduledAt: null,
          // CONTENT-OPS: a manual publish clears any prior expiry — the editor
          // re-sets it via the settings "Expires" field if they still want one.
          expiresAt: null,
          updatedBy: actor.userId,
        })
        .where(this.repo.scope(pages, eq(pages.id, id)))
        .returning();
      await tx.insert(pageVersions).values({
        siteId: this.repo.siteId,
        pageId: id,
        snapshot: { layout: validated, seo: existing.seo } as unknown,
        label: `Published ${now.toISOString()}`,
        authorId: actor.userId,
        createdBy: actor.userId,
      });
      return updated;
    });

    await this.recordAudit(actor, "page.published", id, { slug: row.slug });
    await this.queue.enqueueCachePurge({
      siteId: this.repo.siteId,
      entity: "page",
      entityId: id,
      slug: row.slug,
    });
    await this.queue.enqueueSitemapRebuild({ siteId: this.repo.siteId });
    // E27: raise the outbound webhook event (never throws into this flow).
    await this.webhooks.emit(this.repo.siteId, "page.published", {
      id: row.id,
      slug: row.slug,
      title: row.title,
      publishedAt: row.publishedAt,
    });
    return row;
  }

  // -- B14 editorial workflow -------------------------------------------------

  /**
   * Submit a draft for review: draft → in_review. Optionally assign a reviewer
   * (any site member). Contributors use this instead of publishing directly.
   */
  async submitReview(id: string, dto: SubmitReviewDto, actor: AuthUser): Promise<PageRow> {
    const existing = await this.get(id);
    if (existing.workflowState !== "draft") {
      throw new BadRequestException(
        `Cannot submit for review from '${existing.workflowState}' — only drafts can be submitted`,
      );
    }
    const [row] = await this.repo.db
      .update(pages)
      .set({
        workflowState: "in_review",
        reviewerId: dto.reviewerId ?? null,
        reviewNote: null,
        submittedAt: new Date(),
        reviewedAt: null,
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(pages, eq(pages.id, id)))
      .returning();
    await this.recordAudit(actor, "page.submitted_for_review", id, {
      reviewerId: dto.reviewerId ?? null,
    });
    // Best-effort: notify the assigned reviewer that a review was requested.
    if (row.reviewerId) {
      void this.notifications
        .notify({
          siteId: this.repo.siteId,
          recipientUserId: row.reviewerId,
          type: "review.requested",
          title: `Review requested: "${row.title}"`,
          body: "A page was submitted for your review.",
          entityType: "page",
          entityId: id,
          link: `/pages/${id}`,
          actorUserId: actor.userId,
        })
        .catch(() => {});
    }
    return row;
  }

  /** Approve content in review: in_review → approved (editor+ via @Roles). */
  async approve(id: string, dto: ApproveDto, actor: AuthUser): Promise<PageRow> {
    const existing = await this.get(id);
    if (existing.workflowState !== "in_review") {
      throw new BadRequestException("Only content in review can be approved");
    }
    const [row] = await this.repo.db
      .update(pages)
      .set({
        workflowState: "approved",
        reviewNote: dto.note ?? null,
        reviewedAt: new Date(),
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(pages, eq(pages.id, id)))
      .returning();
    await this.recordAudit(actor, "page.approved", id, { note: dto.note ?? null });
    // Best-effort: notify the author (page.createdBy) that their page was approved.
    void this.notifyAuthor(existing, actor, "review.approved", `Approved: "${row.title}"`, dto.note ?? null, id);
    return row;
  }

  /** Reject content in review back to the author: in_review → draft, with a note. */
  async reject(id: string, dto: RejectDto, actor: AuthUser): Promise<PageRow> {
    const existing = await this.get(id);
    if (existing.workflowState !== "in_review") {
      throw new BadRequestException("Only content in review can be rejected");
    }
    const [row] = await this.repo.db
      .update(pages)
      .set({
        workflowState: "draft",
        reviewNote: dto.note,
        reviewedAt: new Date(),
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(pages, eq(pages.id, id)))
      .returning();
    await this.recordAudit(actor, "page.rejected", id, { note: dto.note });
    // Best-effort: notify the author (page.createdBy) that their page was rejected.
    void this.notifyAuthor(existing, actor, "review.rejected", `Changes requested: "${row.title}"`, dto.note, id);
    return row;
  }

  /**
   * Best-effort notify a page's author (createdBy) on an approve/reject. Never
   * throws into the review flow — the notification is a side benefit.
   */
  private async notifyAuthor(
    page: PageRow,
    actor: AuthUser,
    type: "review.approved" | "review.rejected",
    title: string,
    note: string | null,
    id: string,
  ): Promise<void> {
    const authorId = page.createdBy;
    if (!authorId) return;
    await this.notifications
      .notify({
        siteId: this.repo.siteId,
        recipientUserId: authorId,
        type,
        title,
        body: note ?? undefined,
        entityType: "page",
        entityId: id,
        link: `/pages/${id}`,
        actorUserId: actor.userId,
      })
      .catch(() => {});
  }

  /** Restore a prior version's layout into draftLayout (does not auto-publish). */
  async rollback(id: string, versionId: string, actor: AuthUser): Promise<PageRow> {
    await this.get(id);
    const [version] = await this.repo.db
      .select()
      .from(pageVersions)
      .where(
        this.repo.scope(pageVersions, eq(pageVersions.id, versionId), eq(pageVersions.pageId, id)),
      )
      .limit(1);
    if (!version) throw new NotFoundException("Version not found");
    const snapshot = version.snapshot as { layout?: unknown; seo?: unknown };
    if (!snapshot?.layout) throw new BadRequestException("Version has no layout snapshot");
    const layout = this.validateLayout(snapshot.layout as Record<string, unknown>);
    const [row] = await this.repo.db
      .update(pages)
      .set({
        draftLayout: layout as unknown,
        seo: (snapshot.seo ?? {}) as unknown,
        status: "draft",
        workflowState: "draft",
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(pages, eq(pages.id, id)))
      .returning();
    await this.recordAudit(actor, "page.rolled_back", id, { versionId });
    return row;
  }

  async listVersions(id: string): Promise<PageVersionRow[]> {
    await this.get(id);
    return this.repo.db
      .select()
      .from(pageVersions)
      .where(this.repo.scope(pageVersions, eq(pageVersions.pageId, id)))
      .orderBy(desc(pageVersions.createdAt))
      .limit(100);
  }

  async schedule(id: string, dto: SchedulePageDto, actor: AuthUser): Promise<PageRow> {
    await this.get(id);
    const when = new Date(dto.scheduledAt);
    if (when.getTime() <= Date.now()) {
      throw new BadRequestException("scheduledAt must be in the future");
    }
    const [row] = await this.repo.db
      .update(pages)
      .set({ status: "scheduled", scheduledAt: when, updatedBy: actor.userId })
      .where(this.repo.scope(pages, eq(pages.id, id)))
      .returning();
    await this.recordAudit(actor, "page.scheduled", id, { scheduledAt: when.toISOString() });
    return row;
  }

  async importPoc(dto: ImportPocDto, actor: AuthUser): Promise<PageRow> {
    let result: { seo: PageSeo; layout: SerializedLayout };
    try {
      result = importPocExport(dto.export);
    } catch (err) {
      throw new BadRequestException(`Invalid POC export: ${(err as Error).message}`);
    }
    const title = sanitizeText(result.seo.title || "Imported page");
    const slug = dto.slug ?? this.slugify(result.seo.title || `imported-${Date.now()}`);
    const { defaultLocale } = await this.siteLocales();
    // Imported pages are always root-level (no parentId is set below).
    await this.assertRootSlugAllowed(slug, null);
    await this.assertSlugFree(slug, defaultLocale);
    const [row] = await this.repo.db
      .insert(pages)
      .values({
        ...this.repo.insertDefaults(),
        title,
        slug,
        locale: defaultLocale,
        status: "draft",
        draftLayout: result.layout as unknown,
        seo: this.cleanSeo(result.seo) as unknown,
        schemaVersion: result.layout.schemaVersion,
      })
      .returning();
    const [withKey] = await this.repo.db
      .update(pages)
      .set({ translationKey: row.id })
      .where(this.repo.scope(pages, eq(pages.id, row.id)))
      .returning();
    await this.recordAudit(actor, "page.imported", row.id, { slug });
    return withKey ?? row;
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    await this.get(id);
    await this.repo.db
      .update(pages)
      .set({ deletedAt: new Date(), status: "archived", updatedBy: actor.userId })
      .where(this.repo.scope(pages, eq(pages.id, id)));
    await this.recordAudit(actor, "page.archived", id);
    return { ok: true };
  }

  // -- CONTENT-OPS: draft preview links ---------------------------------------

  /**
   * Mint (or return) a shareable no-login preview link for a page's DRAFT.
   * Ensures the row has a `previewToken` nonce, then derives the capability
   * token `HMAC(secret, page:<id>:<nonce>)` and builds a public URL
   * `https://<site-host>/__preview/page/<id>?token=…`. Idempotent per call while
   * the nonce is unchanged (repeat calls return the same link).
   */
  async createPreviewLink(id: string, actor: AuthUser): Promise<{ url: string; token: string }> {
    const page = await this.get(id);
    let nonce = page.previewToken;
    if (!nonce) {
      nonce = randomBytes(24).toString("hex").slice(0, 48);
      await this.repo.db
        .update(pages)
        .set({ previewToken: nonce, updatedBy: actor.userId })
        .where(this.repo.scope(pages, eq(pages.id, id)));
    }
    const token = computePreviewToken("page", id, nonce);
    const url = `${await this.siteBaseUrl()}/__preview/page/${id}?token=${token}`;
    await this.recordAudit(actor, "page.preview_link_created", id);
    return { url, token };
  }

  /**
   * Revoke every preview link for a page by rotating the nonce to null. Any
   * previously-issued token stops validating immediately.
   */
  async revokePreviewLink(id: string, actor: AuthUser): Promise<{ ok: true }> {
    await this.get(id);
    await this.repo.db
      .update(pages)
      .set({ previewToken: null, updatedBy: actor.userId })
      .where(this.repo.scope(pages, eq(pages.id, id)));
    await this.recordAudit(actor, "page.preview_link_revoked", id);
    return { ok: true };
  }

  /** Resolve the site's public base URL (https://host) for building links. */
  private async siteBaseUrl(): Promise<string> {
    const [site] = await this.repo.db
      .select({
        subdomain: sites.subdomain,
        customDomain: sites.customDomain,
        primaryDomain: sites.primaryDomain,
      })
      .from(sites)
      .where(eq(sites.id, this.repo.siteId))
      .limit(1);
    const base = process.env.RENDERER_BASE_DOMAIN ?? "localhost:3000";
    const domain =
      site?.primaryDomain ||
      site?.customDomain ||
      (site?.subdomain ? `${site.subdomain}.${base}` : base);
    const scheme = domain.startsWith("localhost") ? "http" : "https";
    return `${scheme}://${domain}`;
  }

  // -- helpers ---------------------------------------------------------------

  /** Validate + repair a layout through block-schema. Throws 400 on garbage. */
  private validateLayout(input: Record<string, unknown>): SerializedLayout {
    try {
      return deserializeLayout(JSON.stringify(input));
    } catch (err) {
      throw new BadRequestException(`Invalid layout: ${(err as Error).message}`);
    }
  }

  private cleanSeo(seo?: PageSeoDto | PageSeo): PageSeo {
    if (!seo) return {};
    return {
      title: seo.title != null ? sanitizeText(seo.title) : undefined,
      description: seo.description != null ? sanitizeText(seo.description) : undefined,
      canonical: seo.canonical,
      ogImage: seo.ogImage,
      noindex: typeof seo.noindex === "boolean" ? seo.noindex : undefined,
    };
  }

  private slugify(input: string): string {
    return (
      input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 198) || `page-${Date.now()}`
    );
  }

  /**
   * Slug uniqueness is per (site, LOCALE) — i18n (B13). A slug may repeat across
   * locales (e.g. /about and /es/about) but not within one. `locale` defaults to
   * the site default for new default-locale pages.
   */
  /**
   * Reject slugs that would collide with the renderer's reserved root
   * namespaces (blog/, c/, api/, ... — see RESERVED_ROOT_SLUGS in @ob-cms/shared).
   * Only ROOT-LEVEL pages are at risk: the first public path segment is this
   * page's own slug iff its parent chain contributes nothing (no parent, or a
   * chain of `home` ancestors — mirrors {@link resolvePagePath}). A nested page
   * like `/services/blog` is safe, because its first segment is `services`,
   * which was itself validated when that ancestor was created.
   *
   * Fails closed: a dangling `parentId` is treated as root-level.
   */
  private async assertRootSlugAllowed(slug: string, parentId: string | null): Promise<void> {
    if (!isReservedRootSlug(slug)) return;
    if (parentId) {
      const [parent] = await this.repo.db
        .select({ id: pages.id, slug: pages.slug, parentId: pages.parentId })
        .from(pages)
        .where(this.repo.scope(pages, eq(pages.id, parentId)))
        .limit(1);
      // Nested under a real (non-home) ancestor → first segment isn't this slug.
      if (parent && (await this.resolvePagePath(parent)) !== "/") return;
    }
    throw new BadRequestException(
      `Slug '${slug}' is reserved for system routes (feeds, blog, collections, APIs) and cannot be used for a top-level page. Rename the page or nest it under a parent.`,
    );
  }

  private async assertSlugFree(slug: string, locale: string, excludeId?: string): Promise<void> {
    const [row] = await this.repo.db
      .select({ id: pages.id })
      .from(pages)
      .where(this.repo.scope(pages, eq(pages.slug, slug), eq(pages.locale, locale)))
      .limit(1);
    if (row && row.id !== excludeId) throw new ConflictException("A page with this slug already exists");
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
      entityType: "page",
      entityId,
      metadata,
    });
  }
}

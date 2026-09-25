import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { and, desc, eq, ilike, inArray, isNotNull, type SQL } from "drizzle-orm";
import { sanitizeText } from "@ob-cms/block-schema";
import { computePreviewToken } from "@ob-cms/crypto";
import {
  postTerms,
  posts,
  sites,
  siteSettings,
  type PostRow,
  type PostTermRow,
} from "@database/schema";
import { normalizeLocales } from "@modules/sites/sites.service";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { WebhooksEmitter } from "@modules/webhooks/webhooks-emitter.service";
import { TenantContext } from "@common/tenancy/tenant-context";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import type {
  ApproveDto,
  BulkPostsDto,
  CreatePostDto,
  CreateTranslationDto,
  ListPostsQueryDto,
  ListTermsQueryDto,
  PostTermDto,
  RejectDto,
  SavePostLayoutDto,
  SchedulePostDto,
  SubmitReviewDto,
  TermDto,
  UpdatePostDto,
} from "./dto/post.dto";
import type { CreatePostOptions } from "./create-post-options";

interface PostWithTerms extends PostRow {
  terms: PostTermRow[];
}

/** Aggregated taxonomy term (one row per kind+slug across the site). */
export interface TermSummary {
  kind: string;
  name: string;
  slug: string;
  count: number;
}

/** Blog posts — same draft/publish lifecycle as pages, plus category/tag terms. */
@Injectable()
export class BlogService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly ctx: TenantContext,
    private readonly webhooks: WebhooksEmitter,
  ) {}

  async list(query: ListPostsQueryDto): Promise<PostRow[]> {
    const extra: Array<SQL | undefined> = [];
    if (query.status) extra.push(eq(posts.status, query.status));
    if (query.state) extra.push(eq(posts.workflowState, query.state));
    if (query.assignedTo) {
      const reviewerId = query.assignedTo === "me" ? this.ctx.userId : query.assignedTo;
      extra.push(eq(posts.reviewerId, reviewerId ?? "__none__"));
    }
    if (query.q) extra.push(ilike(posts.title, `%${query.q}%`));
    // i18n: optionally narrow to one locale's posts.
    if (query.locale) extra.push(eq(posts.locale, query.locale));
    // Taxonomy filter: narrow to posts carrying the matching category/tag term.
    const termFilter = query.category
      ? { kind: "category", value: query.category }
      : query.tag
        ? { kind: "tag", value: query.tag }
        : null;
    if (termFilter) {
      const termRows = await this.repo.db
        .select({ postId: postTerms.postId })
        .from(postTerms)
        .where(
          this.repo.scope(
            postTerms,
            eq(postTerms.kind, termFilter.kind),
            eq(postTerms.slug, this.slugify(termFilter.value)),
          ),
        );
      // post_id is nullable (standalone taxonomy terms), so drop nulls.
      const ids = termRows.map((r) => r.postId).filter((x): x is string => x !== null);
      if (ids.length === 0) return [];
      extra.push(inArray(posts.id, ids));
    }
    // Trash view: deleted rows are hidden by `repo.scope`, so query them with the
    // explicit tenant predicate + isNotNull(deletedAt). Default view uses scope.
    const where = query.trashed
      ? and(eq(posts.siteId, this.repo.siteId), isNotNull(posts.deletedAt), ...extra)
      : this.repo.scope(posts, ...extra);
    return this.repo.db
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(posts.updatedAt))
      .limit(500);
  }

  async get(id: string): Promise<PostWithTerms> {
    const [row] = await this.repo.db
      .select()
      .from(posts)
      .where(this.repo.scope(posts, eq(posts.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Post not found");
    const terms = await this.repo.db
      .select()
      .from(postTerms)
      .where(this.repo.scope(postTerms, eq(postTerms.postId, id)));
    return { ...row, terms };
  }

  async create(
    dto: CreatePostDto,
    actor: AuthUser,
    options?: CreatePostOptions,
  ): Promise<PostWithTerms> {
    // i18n: new posts are authored in the site default locale and start their
    // own translation group (translationKey := the new row's id).
    const { defaultLocale } = await this.siteLocales();
    await this.assertSlugFree(dto.slug, defaultLocale);
    const hubspotSource = options?.hubspotSourceIdentity;
    const [row] = await this.repo.db
      .insert(posts)
      .values({
        ...this.repo.insertDefaults(),
        title: sanitizeText(dto.title),
        slug: dto.slug,
        locale: defaultLocale,
        status: "draft",
        excerpt: dto.excerpt != null ? sanitizeText(dto.excerpt) : null,
        layout: (dto.layout ?? null) as unknown,
        coverMediaId: dto.coverMediaId ?? null,
        seo: (dto.seo ?? {}) as unknown,
        authorId: actor.userId,
        hubspotConnectionId: hubspotSource?.hubspotConnectionId ?? null,
        hubspotKind: hubspotSource?.hubspotKind ?? null,
        hubspotHsId: hubspotSource?.hubspotHsId ?? null,
      })
      .returning();
    await this.repo.db
      .update(posts)
      .set({ translationKey: row.id })
      .where(this.repo.scope(posts, eq(posts.id, row.id)));
    if (dto.terms?.length) await this.replaceTerms(row.id, dto.terms, actor);
    await this.recordAudit(actor, "post.created", row.id, { slug: row.slug });
    return this.get(row.id);
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

  /** i18n (B13): list the sibling-locale translations of a post (incl. itself). */
  async listTranslations(id: string): Promise<PostRow[]> {
    const source = await this.get(id);
    const key = source.translationKey ?? source.id;
    return this.repo.db
      .select()
      .from(posts)
      .where(this.repo.scope(posts, eq(posts.translationKey, key)))
      .orderBy(desc(posts.locale));
  }

  /**
   * i18n (B13): create a translation of a post in another locale. Clones the
   * source layout/excerpt/seo into a NEW row with the same translationKey, the
   * target locale, its own slug, and status draft.
   */
  async createTranslation(
    id: string,
    dto: CreateTranslationDto,
    actor: AuthUser,
  ): Promise<PostRow> {
    const source = await this.get(id);
    const { locales } = await this.siteLocales();
    if (!locales.includes(dto.locale)) {
      throw new BadRequestException(
        `Locale '${dto.locale}' is not enabled for this site. Add it in Settings first.`,
      );
    }
    if (dto.locale === source.locale) {
      throw new BadRequestException("Target locale matches the source post's locale");
    }
    const key = source.translationKey ?? source.id;
    const siblings = await this.repo.db
      .select({ locale: posts.locale })
      .from(posts)
      .where(this.repo.scope(posts, eq(posts.translationKey, key)));
    if (siblings.some((s) => s.locale === dto.locale)) {
      throw new ConflictException(`A '${dto.locale}' translation already exists`);
    }
    const slug = dto.slug ?? source.slug;
    await this.assertSlugFree(slug, dto.locale);
    const [row] = await this.repo.db
      .insert(posts)
      .values({
        ...this.repo.insertDefaults(),
        title: source.title,
        slug,
        locale: dto.locale,
        translationKey: key,
        status: "draft",
        workflowState: "draft",
        excerpt: source.excerpt,
        layout: source.layout as unknown,
        coverMediaId: source.coverMediaId,
        seo: source.seo as unknown,
        authorId: actor.userId,
      })
      .returning();
    await this.recordAudit(actor, "post.translation_created", row.id, {
      locale: dto.locale,
      translationKey: key,
      sourceId: source.id,
    });
    return row;
  }

  async update(id: string, dto: UpdatePostDto, actor: AuthUser): Promise<PostWithTerms> {
    const existing = await this.get(id);
    if (dto.slug && dto.slug !== existing.slug) {
      await this.assertSlugFree(dto.slug, existing.locale, id);
    }
    const patch: Partial<PostRow> = { updatedBy: actor.userId };
    if (dto.title !== undefined) patch.title = sanitizeText(dto.title);
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.excerpt !== undefined) patch.excerpt = sanitizeText(dto.excerpt);
    if (dto.layout !== undefined) patch.layout = dto.layout as unknown;
    if (dto.coverMediaId !== undefined) patch.coverMediaId = dto.coverMediaId;
    if (dto.seo !== undefined) patch.seo = dto.seo as unknown;
    if (dto.status !== undefined) patch.status = dto.status;
    // CONTENT-OPS expiry: set (ISO string) or clear (null).
    if (dto.expiresAt !== undefined) {
      patch.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    await this.repo.db
      .update(posts)
      .set(patch)
      .where(this.repo.scope(posts, eq(posts.id, id)));
    if (dto.terms !== undefined) await this.replaceTerms(id, dto.terms, actor);
    await this.recordAudit(actor, "post.updated", id, { fields: Object.keys(dto) });
    return this.get(id);
  }

  async publish(id: string, actor: AuthUser): Promise<PostRow> {
    const existing = await this.get(id);
    // B14 editorial gate: a post in review must be approved/rejected first.
    if (existing.workflowState === "in_review") {
      throw new BadRequestException(
        "Post is in review — approve it (or reject) before publishing",
      );
    }
    if (!existing.layout) throw new BadRequestException("Nothing to publish — post has no body");
    const [row] = await this.repo.db
      .update(posts)
      .set({
        status: "published",
        workflowState: "published",
        publishedAt: new Date(),
        scheduledAt: null,
        // CONTENT-OPS: a manual publish clears any prior expiry.
        expiresAt: null,
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(posts, eq(posts.id, id)))
      .returning();
    await this.recordAudit(actor, "post.published", id, { slug: row.slug });
    await this.queue.enqueueCachePurge({
      siteId: this.repo.siteId,
      entity: "post",
      entityId: id,
      slug: row.slug,
    });
    await this.queue.enqueueSitemapRebuild({ siteId: this.repo.siteId });
    await this.webhooks.emit(this.repo.siteId, "post.published", { id: row.id, slug: row.slug, title: row.title, publishedAt: row.publishedAt });
    return row;
  }

  async schedule(id: string, dto: SchedulePostDto, actor: AuthUser): Promise<PostRow> {
    await this.get(id);
    const when = new Date(dto.scheduledAt);
    if (when.getTime() <= Date.now()) throw new BadRequestException("scheduledAt must be in the future");
    const [row] = await this.repo.db
      .update(posts)
      .set({ status: "scheduled", scheduledAt: when, updatedBy: actor.userId })
      .where(this.repo.scope(posts, eq(posts.id, id)))
      .returning();
    await this.recordAudit(actor, "post.scheduled", id, { scheduledAt: when.toISOString() });
    return row;
  }

  // -- B14 editorial workflow -------------------------------------------------

  /** Submit a draft for review: draft → in_review (optionally assign a reviewer). */
  async submitReview(id: string, dto: SubmitReviewDto, actor: AuthUser): Promise<PostRow> {
    const existing = await this.get(id);
    if (existing.workflowState !== "draft") {
      throw new BadRequestException(
        `Cannot submit for review from '${existing.workflowState}' — only drafts can be submitted`,
      );
    }
    const [row] = await this.repo.db
      .update(posts)
      .set({
        workflowState: "in_review",
        reviewerId: dto.reviewerId ?? null,
        reviewNote: null,
        submittedAt: new Date(),
        reviewedAt: null,
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(posts, eq(posts.id, id)))
      .returning();
    await this.recordAudit(actor, "post.submitted_for_review", id, {
      reviewerId: dto.reviewerId ?? null,
    });
    return row;
  }

  /** Approve content in review: in_review → approved (editor+ via @Roles). */
  async approve(id: string, dto: ApproveDto, actor: AuthUser): Promise<PostRow> {
    const existing = await this.get(id);
    if (existing.workflowState !== "in_review") {
      throw new BadRequestException("Only content in review can be approved");
    }
    const [row] = await this.repo.db
      .update(posts)
      .set({
        workflowState: "approved",
        reviewNote: dto.note ?? null,
        reviewedAt: new Date(),
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(posts, eq(posts.id, id)))
      .returning();
    await this.recordAudit(actor, "post.approved", id, { note: dto.note ?? null });
    return row;
  }

  /** Reject content in review back to the author: in_review → draft, with a note. */
  async reject(id: string, dto: RejectDto, actor: AuthUser): Promise<PostRow> {
    const existing = await this.get(id);
    if (existing.workflowState !== "in_review") {
      throw new BadRequestException("Only content in review can be rejected");
    }
    const [row] = await this.repo.db
      .update(posts)
      .set({
        workflowState: "draft",
        reviewNote: dto.note,
        reviewedAt: new Date(),
        updatedBy: actor.userId,
      })
      .where(this.repo.scope(posts, eq(posts.id, id)))
      .returning();
    await this.recordAudit(actor, "post.rejected", id, { note: dto.note });
    return row;
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    await this.get(id);
    await this.repo.db
      .update(posts)
      .set({ deletedAt: new Date(), status: "archived", updatedBy: actor.userId })
      .where(this.repo.scope(posts, eq(posts.id, id)));
    await this.recordAudit(actor, "post.archived", id);
    return { ok: true };
  }

  /** Autosave the draft layout only (visual builder PUT). Keeps current status. */
  async saveLayout(id: string, dto: SavePostLayoutDto, actor: AuthUser): Promise<PostRow> {
    await this.get(id);
    const [row] = await this.repo.db
      .update(posts)
      .set({ layout: dto.layout as unknown, updatedBy: actor.userId })
      .where(this.repo.scope(posts, eq(posts.id, id)))
      .returning();
    await this.recordAudit(actor, "post.layout_saved", id);
    return row;
  }

  /** Restore a soft-deleted (trashed) post back to draft. */
  async restore(id: string, actor: AuthUser): Promise<PostRow> {
    const [existing] = await this.repo.db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.siteId, this.repo.siteId), eq(posts.id, id), isNotNull(posts.deletedAt)))
      .limit(1);
    if (!existing) throw new NotFoundException("Trashed post not found");
    const [row] = await this.repo.db
      .update(posts)
      .set({ deletedAt: null, status: "draft", updatedBy: actor.userId })
      .where(and(eq(posts.siteId, this.repo.siteId), eq(posts.id, id)))
      .returning();
    await this.recordAudit(actor, "post.restored", id);
    return row;
  }

  /** Permanently delete a trashed post (hard delete + its terms). */
  async destroy(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const [existing] = await this.repo.db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.siteId, this.repo.siteId), eq(posts.id, id), isNotNull(posts.deletedAt)))
      .limit(1);
    if (!existing) throw new NotFoundException("Trashed post not found");
    await this.repo.db
      .delete(postTerms)
      .where(and(eq(postTerms.siteId, this.repo.siteId), eq(postTerms.postId, id)));
    await this.repo.db
      .delete(posts)
      .where(and(eq(posts.siteId, this.repo.siteId), eq(posts.id, id)));
    await this.recordAudit(actor, "post.destroyed", id);
    return { ok: true };
  }

  // -- bulk ------------------------------------------------------------------

  async bulkPublish(dto: BulkPostsDto, actor: AuthUser): Promise<{ count: number }> {
    let count = 0;
    for (const id of dto.ids) {
      try {
        await this.publish(id, actor);
        count++;
      } catch {
        /* skip posts that can't publish (e.g. empty body / missing) */
      }
    }
    return { count };
  }

  async bulkTrash(dto: BulkPostsDto, actor: AuthUser): Promise<{ count: number }> {
    if (!dto.ids.length) return { count: 0 };
    const rows = await this.repo.db
      .update(posts)
      .set({ deletedAt: new Date(), status: "archived", updatedBy: actor.userId })
      .where(this.repo.scope(posts, inArray(posts.id, dto.ids)))
      .returning({ id: posts.id });
    await this.recordAudit(actor, "post.bulk_archived", "*", { ids: rows.map((r) => r.id) });
    return { count: rows.length };
  }

  async bulkRestore(dto: BulkPostsDto, actor: AuthUser): Promise<{ count: number }> {
    if (!dto.ids.length) return { count: 0 };
    const rows = await this.repo.db
      .update(posts)
      .set({ deletedAt: null, status: "draft", updatedBy: actor.userId })
      .where(
        and(
          eq(posts.siteId, this.repo.siteId),
          inArray(posts.id, dto.ids),
          isNotNull(posts.deletedAt),
        ),
      )
      .returning({ id: posts.id });
    await this.recordAudit(actor, "post.bulk_restored", "*", { ids: rows.map((r) => r.id) });
    return { count: rows.length };
  }

  // -- taxonomy --------------------------------------------------------------

  /** Distinct terms (category/tag) across the site, with usage counts. */
  async listTerms(query: ListTermsQueryDto): Promise<TermSummary[]> {
    const extra = query.kind ? [eq(postTerms.kind, query.kind)] : [];
    const rows = await this.repo.db
      .select()
      .from(postTerms)
      .where(this.repo.scope(postTerms, ...extra));
    const map = new Map<string, TermSummary>();
    for (const r of rows) {
      const key = `${r.kind}:${r.slug}`;
      const cur = map.get(key);
      // postId === null → a standalone term definition (no usage). Real
      // assignments (non-null postId) increment the usage count.
      const used = r.postId ? 1 : 0;
      if (cur) cur.count += used;
      else map.set(key, { kind: r.kind, name: r.name, slug: r.slug, count: used });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Create a "standalone" term (no post yet) so it appears in the taxonomy
   * manager. Stored as a postTerms row with postId = null-sentinel ("").
   * Idempotent per kind+slug.
   */
  async createTerm(dto: TermDto, actor: AuthUser): Promise<TermSummary> {
    const slug = this.slugify(dto.name);
    const name = sanitizeText(dto.name);
    const [existing] = await this.repo.db
      .select({ id: postTerms.id })
      .from(postTerms)
      .where(this.repo.scope(postTerms, eq(postTerms.kind, dto.kind), eq(postTerms.slug, slug)))
      .limit(1);
    if (!existing) {
      await this.repo.db.insert(postTerms).values({
        ...this.repo.insertDefaults(),
        postId: null,
        kind: dto.kind,
        name,
        slug,
      });
    }
    await this.recordAudit(actor, "term.created", slug, { kind: dto.kind, name });
    return { kind: dto.kind, name, slug, count: 0 };
  }

  /** Rename every occurrence of a term (kind+slug) across the site. */
  async updateTerm(kind: string, slug: string, name: string, actor: AuthUser): Promise<TermSummary> {
    const nextName = sanitizeText(name);
    const nextSlug = this.slugify(name);
    const rows = await this.repo.db
      .update(postTerms)
      .set({ name: nextName, slug: nextSlug, updatedBy: actor.userId })
      .where(this.repo.scope(postTerms, eq(postTerms.kind, kind), eq(postTerms.slug, slug)))
      .returning({ id: postTerms.id });
    if (rows.length === 0) throw new NotFoundException("Term not found");
    await this.recordAudit(actor, "term.updated", nextSlug, { kind, from: slug });
    return { kind, name: nextName, slug: nextSlug, count: rows.length };
  }

  /** Remove a term (kind+slug) from every post on the site. */
  async deleteTerm(kind: string, slug: string, actor: AuthUser): Promise<{ ok: true }> {
    await this.repo.db
      .delete(postTerms)
      .where(this.repo.scope(postTerms, eq(postTerms.kind, kind), eq(postTerms.slug, slug)));
    await this.recordAudit(actor, "term.deleted", slug, { kind });
    return { ok: true };
  }

  // -- CONTENT-OPS: draft preview links ---------------------------------------

  /** Mint (or return) a shareable no-login preview link for a post's DRAFT. */
  async createPreviewLink(id: string, actor: AuthUser): Promise<{ url: string; token: string }> {
    const post = await this.get(id);
    let nonce = post.previewToken;
    if (!nonce) {
      nonce = randomBytes(24).toString("hex").slice(0, 48);
      await this.repo.db
        .update(posts)
        .set({ previewToken: nonce, updatedBy: actor.userId })
        .where(this.repo.scope(posts, eq(posts.id, id)));
    }
    const token = computePreviewToken("post", id, nonce);
    const url = `${await this.siteBaseUrl()}/__preview/post/${id}?token=${token}`;
    await this.recordAudit(actor, "post.preview_link_created", id);
    return { url, token };
  }

  /** Revoke every preview link for a post by rotating the nonce to null. */
  async revokePreviewLink(id: string, actor: AuthUser): Promise<{ ok: true }> {
    await this.get(id);
    await this.repo.db
      .update(posts)
      .set({ previewToken: null, updatedBy: actor.userId })
      .where(this.repo.scope(posts, eq(posts.id, id)));
    await this.recordAudit(actor, "post.preview_link_revoked", id);
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

  private async replaceTerms(postId: string, terms: PostTermDto[], actor: AuthUser): Promise<void> {
    await this.repo.db.delete(postTerms).where(this.repo.scope(postTerms, eq(postTerms.postId, postId)));
    if (!terms.length) return;
    const seen = new Set<string>();
    const rows: (typeof postTerms.$inferInsert)[] = [];
    for (const t of terms) {
      const name = sanitizeText(t.name);
      const slug = this.slugify(t.name);
      const key = `${t.kind}:${slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        ...this.repo.insertDefaults(),
        postId,
        kind: t.kind,
        name,
        slug,
      });
    }
    if (rows.length) await this.repo.db.insert(postTerms).values(rows);
  }

  private slugify(input: string): string {
    return (
      input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 138) ||
      `term-${Date.now()}`
    );
  }

  /** Slug uniqueness is per (site, LOCALE) — i18n (B13). */
  private async assertSlugFree(slug: string, locale: string, excludeId?: string): Promise<void> {
    const [row] = await this.repo.db
      .select({ id: posts.id })
      .from(posts)
      .where(this.repo.scope(posts, eq(posts.slug, slug), eq(posts.locale, locale)))
      .limit(1);
    if (row && row.id !== excludeId) throw new ConflictException("A post with this slug already exists");
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
      entityType: "post",
      entityId,
      metadata,
    });
  }
}

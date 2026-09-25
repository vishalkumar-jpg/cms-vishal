import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, ilike, isNull } from "drizzle-orm";
import { pageComments, pages, systemUsers, type PageCommentRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { NotificationsService } from "@modules/notifications/notifications.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type {
  CreateCommentDto,
  ReplyCommentDto,
  ResolveCommentDto,
} from "./dto/comment.dto";

/** A comment enriched with its author's display info (for avatars/initials). */
export interface CommentView extends PageCommentRow {
  authorName: string | null;
  authorEmail: string | null;
}

/**
 * Builder page-comments (COLLAB). Site-scoped through {@link ScopedRepository};
 * every mutation is audited. Threads are one level deep: a root (parentId null)
 * plus flat replies whose parentId is the root. `threadId` always points at the
 * root so a page's threads group with a single indexed read.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** All non-deleted comments for a page (roots + replies), oldest first. */
  async listForPage(pageId: string): Promise<CommentView[]> {
    const rows = await this.repo.db
      .select({
        c: pageComments,
        authorName: systemUsers.name,
        authorEmail: systemUsers.email,
      })
      .from(pageComments)
      .leftJoin(systemUsers, eq(systemUsers.id, pageComments.authorId))
      .where(this.repo.scope(pageComments, eq(pageComments.pageId, pageId)))
      .orderBy(asc(pageComments.createdAt))
      .limit(2000);
    return rows.map((r) => ({ ...r.c, authorName: r.authorName, authorEmail: r.authorEmail }));
  }

  private async getRow(id: string): Promise<PageCommentRow> {
    const [row] = await this.repo.db
      .select()
      .from(pageComments)
      .where(this.repo.scope(pageComments, eq(pageComments.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Comment not found");
    return row;
  }

  /** Create a new thread root (anchored to a node or a canvas point). */
  async create(dto: CreateCommentDto, actor: AuthUser): Promise<CommentView> {
    const hasNode = typeof dto.nodeId === "string" && dto.nodeId.length > 0;
    const hasPoint = typeof dto.anchorX === "number" && typeof dto.anchorY === "number";
    if (!hasNode && !hasPoint) {
      throw new BadRequestException("A comment must anchor to a node or a canvas point");
    }
    const [row] = await this.repo.db
      .insert(pageComments)
      .values({
        ...this.repo.insertDefaults(),
        pageId: dto.pageId,
        // threadId is set to the row's own id after insert (see below).
        threadId: "pending",
        parentId: null,
        nodeId: hasNode ? dto.nodeId : null,
        anchorX: hasNode ? null : dto.anchorX,
        anchorY: hasNode ? null : dto.anchorY,
        body: dto.body,
        authorId: actor.userId,
        resolved: false,
      })
      .returning();
    // A root's threadId is its own id.
    const [updated] = await this.repo.db
      .update(pageComments)
      .set({ threadId: row.id })
      .where(this.repo.scope(pageComments, eq(pageComments.id, row.id)))
      .returning();
    await this.recordAudit(actor, "comment.created", updated.id, { pageId: dto.pageId });
    // Best-effort: notify the page author + any @mentioned members. A
    // notification failure must never break the comment.
    void this.emitCommentNotifications(updated, actor, "comment.added").catch(() => {});
    return this.withAuthor(updated);
  }

  /** Add a reply to an existing thread (flattened one level under the root). */
  async reply(rootId: string, dto: ReplyCommentDto, actor: AuthUser): Promise<CommentView> {
    const root = await this.getRow(rootId);
    if (root.parentId) throw new BadRequestException("Can only reply to a thread root");
    const [row] = await this.repo.db
      .insert(pageComments)
      .values({
        ...this.repo.insertDefaults(),
        pageId: root.pageId,
        threadId: root.threadId,
        parentId: root.id,
        nodeId: root.nodeId,
        anchorX: null,
        anchorY: null,
        body: dto.body,
        authorId: actor.userId,
        resolved: false,
      })
      .returning();
    await this.recordAudit(actor, "comment.replied", row.id, { threadId: root.threadId });
    // Best-effort: notify the page author + the other thread participants +
    // any @mentioned members. Never breaks the reply.
    void this.emitCommentNotifications(row, actor, "comment.reply").catch(() => {});
    return this.withAuthor(row);
  }

  /** Resolve/reopen a whole thread (applies to the root + all replies). */
  async setResolved(rootId: string, dto: ResolveCommentDto, actor: AuthUser): Promise<{ ok: true }> {
    const root = await this.getRow(rootId);
    if (root.parentId) throw new BadRequestException("Resolve the thread root, not a reply");
    await this.repo.db
      .update(pageComments)
      .set({ resolved: dto.resolved, updatedBy: actor.userId })
      .where(this.repo.scope(pageComments, eq(pageComments.threadId, root.threadId)));
    await this.recordAudit(
      actor,
      dto.resolved ? "comment.resolved" : "comment.reopened",
      root.id,
    );
    return { ok: true };
  }

  /** Soft-delete a comment. Deleting a root soft-deletes the whole thread. */
  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const row = await this.getRow(id);
    const deletedAt = new Date();
    if (!row.parentId) {
      // Root: nuke the whole thread.
      await this.repo.db
        .update(pageComments)
        .set({ deletedAt, updatedBy: actor.userId })
        .where(this.repo.scope(pageComments, eq(pageComments.threadId, row.threadId)));
    } else {
      await this.repo.db
        .update(pageComments)
        .set({ deletedAt, updatedBy: actor.userId })
        .where(this.repo.scope(pageComments, eq(pageComments.id, id)));
    }
    await this.recordAudit(actor, "comment.deleted", id);
    return { ok: true };
  }

  private async withAuthor(row: PageCommentRow): Promise<CommentView> {
    const [author] = await this.repo.db
      .select({ name: systemUsers.name, email: systemUsers.email })
      .from(systemUsers)
      .where(eq(systemUsers.id, row.authorId))
      .limit(1);
    return { ...row, authorName: author?.name ?? null, authorEmail: author?.email ?? null };
  }

  /**
   * Emit best-effort in-app notifications for a new comment / reply:
   *   - the page's author (createdBy) — unless they are the actor,
   *   - the other thread participants (reply case),
   *   - any naive "@name" mention found in the body → `comment.mention`.
   * Recipients are deduped and the actor is always excluded (the service also
   * self-suppresses). Any failure is swallowed by the caller's `.catch()`.
   */
  private async emitCommentNotifications(
    comment: PageCommentRow,
    actor: AuthUser,
    type: "comment.added" | "comment.reply",
  ): Promise<void> {
    const siteId = this.repo.siteId;
    const link = `/pages/${comment.pageId}#${comment.threadId}`;
    const preview = comment.body.slice(0, 200);

    // Page author (createdBy on the page row).
    const [page] = await this.repo.db
      .select({ createdBy: pages.createdBy, title: pages.title })
      .from(pages)
      .where(this.repo.scope(pages, eq(pages.id, comment.pageId)))
      .limit(1);

    const recipients: Array<string | null | undefined> = [page?.createdBy];

    // Other thread participants (distinct comment authors on this thread).
    if (type === "comment.reply") {
      const participants = await this.repo.db
        .select({ authorId: pageComments.authorId })
        .from(pageComments)
        .where(this.repo.scope(pageComments, eq(pageComments.threadId, comment.threadId)));
      for (const p of participants) recipients.push(p.authorId);
    }

    const pageTitle = page?.title ?? "a page";
    await this.notifications.notifyMany(recipients, {
      siteId,
      type,
      title: type === "comment.reply" ? `New reply on "${pageTitle}"` : `New comment on "${pageTitle}"`,
      body: preview,
      entityType: "page_comment",
      entityId: comment.id,
      link,
      actorUserId: actor.userId,
    });

    // Naive @mentions: resolve "@name" tokens against site members and notify.
    await this.emitMentions(comment, actor, pageTitle, link);
  }

  /** Resolve naive "@name" tokens in a body to site users and notify them. */
  private async emitMentions(
    comment: PageCommentRow,
    actor: AuthUser,
    pageTitle: string,
    link: string,
  ): Promise<void> {
    const names = Array.from(
      new Set((comment.body.match(/@([a-z0-9_.-]{2,50})/gi) ?? []).map((m) => m.slice(1))),
    );
    if (names.length === 0) return;
    for (const name of names) {
      // Match a site member by exact-ish name (case-insensitive). Only members
      // of the ACTIVE site are candidates (join is scoped by the mention flow's
      // notify(siteId) — we resolve the user id here).
      const [user] = await this.repo.db
        .select({ id: systemUsers.id })
        .from(systemUsers)
        .where(and(ilike(systemUsers.name, name), isNull(systemUsers.deletedAt)))
        .limit(1);
      if (!user) continue;
      await this.notifications.notify({
        siteId: this.repo.siteId,
        recipientUserId: user.id,
        type: "comment.mention",
        title: `You were mentioned on "${pageTitle}"`,
        body: comment.body.slice(0, 200),
        entityType: "page_comment",
        entityId: comment.id,
        link,
        actorUserId: actor.userId,
      });
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
      category: "content",
      entityType: "page_comment",
      entityId,
      metadata,
    });
  }
}

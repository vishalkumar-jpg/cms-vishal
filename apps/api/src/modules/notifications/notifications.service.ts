import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { notifications, systemUsers, type NotificationRow } from "@database/schema";

/** A notification enriched with its actor's display info (for the bell UI). */
export interface NotificationView extends NotificationRow {
  actorName: string | null;
  actorEmail: string | null;
}

/** The read-model payload for `GET /notifications`. */
export interface NotificationList {
  items: NotificationView[];
  unreadCount: number;
}

export interface NotifyInput {
  siteId: string;
  recipientUserId: string;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  link?: string | null;
  actorUserId?: string | null;
}

/**
 * NotificationsService — the writer + read model for the header bell.
 *
 * The WRITER (`notify`) mirrors WebhooksEmitter: it is NOT request-scoped and
 * takes `siteId`/`recipientUserId` explicitly, so it can be called from the
 * comment + editorial-workflow paths as a best-effort side effect (the callers
 * wrap it in `void … .catch()`; it also swallows its own errors so a
 * notification problem can never break the source action). It self-suppresses
 * a notification to the actor themselves.
 *
 * The READ model (`list`/`markRead`/`markAllRead`) is current-user-scoped: every
 * query is ANDed with `recipientUserId == me` AND `siteId == active`, so a user
 * only ever sees / mutates THEIR OWN notifications within the active site.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Create one notification. Best-effort: never throws into the caller. Skips
   * self-notifications (actor === recipient) and empty recipients.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      if (!input.recipientUserId) return;
      if (input.actorUserId && input.actorUserId === input.recipientUserId) return;
      await this.db.insert(notifications).values({
        siteId: input.siteId,
        recipientUserId: input.recipientUserId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        link: input.link ?? null,
        actorUserId: input.actorUserId ?? null,
        createdBy: input.actorUserId ?? null,
      });
    } catch (err) {
      this.logger.error(`notify failed (${input.type}): ${(err as Error).message}`);
    }
  }

  /** Fan one event out to many recipients (deduped, actor excluded). */
  async notifyMany(recipients: Array<string | null | undefined>, base: Omit<NotifyInput, "recipientUserId">): Promise<void> {
    const seen = new Set<string>();
    for (const r of recipients) {
      if (!r || seen.has(r)) continue;
      seen.add(r);
      await this.notify({ ...base, recipientUserId: r });
    }
  }

  // -- read model (current-user-scoped) --------------------------------------

  /** The active user's recent notifications + their unread count. */
  async list(
    siteId: string,
    recipientUserId: string,
    unreadOnly = false,
    limit = 30,
  ): Promise<NotificationList> {
    const base = and(
      eq(notifications.siteId, siteId),
      eq(notifications.recipientUserId, recipientUserId),
      isNull(notifications.deletedAt),
    );
    const where = unreadOnly ? and(base, isNull(notifications.readAt)) : base;
    const rows = await this.db
      .select({
        n: notifications,
        actorName: systemUsers.name,
        actorEmail: systemUsers.email,
      })
      .from(notifications)
      .leftJoin(systemUsers, eq(systemUsers.id, notifications.actorUserId))
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    const items = rows.map((r) => ({
      ...r.n,
      actorName: r.actorName,
      actorEmail: r.actorEmail,
    }));
    const unreadCount = await this.unreadCount(siteId, recipientUserId);
    return { items, unreadCount };
  }

  /** The active user's unread count (drives the badge). */
  async unreadCount(siteId: string, recipientUserId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.siteId, siteId),
          eq(notifications.recipientUserId, recipientUserId),
          isNull(notifications.deletedAt),
          isNull(notifications.readAt),
        ),
      );
    return Number(row?.n ?? 0);
  }

  /** Mark one of MY notifications read (scoped so I can't touch others'). */
  async markRead(siteId: string, recipientUserId: string, id: string): Promise<{ ok: true }> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.siteId, siteId),
          eq(notifications.recipientUserId, recipientUserId),
          isNull(notifications.readAt),
        ),
      );
    return { ok: true };
  }

  /** Mark ALL of MY unread notifications read. */
  async markAllRead(siteId: string, recipientUserId: string): Promise<{ ok: true }> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.siteId, siteId),
          eq(notifications.recipientUserId, recipientUserId),
          isNull(notifications.readAt),
        ),
      );
    return { ok: true };
  }
}

import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { webhookDeliveries, webhooks } from "@database/schema";
import { QueueService } from "@modules/queue/queue.service";
import type { WebhookEvent } from "./webhook-events";

/**
 * WebhooksEmitter (E27) — the ONE in-lane seam for raising an outbound event.
 *
 * Other modules (pages/blog/forms) call `emit(siteId, event, payload)` when a
 * page/post is published or a form is submitted. The emitter looks up every
 * ACTIVE subscription on that site whose `events` include the name, writes a
 * durable `webhook_deliveries` row per match (Postgres = source of truth), and
 * enqueues a delivery job per row. The worker signs + POSTs and advances the
 * row's status with retry/backoff → DLQ.
 *
 * It is NOT request-scoped and takes `siteId` explicitly, so it can be called
 * from any context (including the existing publish paths) without a TenantContext.
 *
 * To wire emission without touching the off-limits modules, this service is
 * exported from WebhooksModule; the one-line call-sites are documented in
 * apps/api/CONTENT-API.md. `sendTest()` exercises the full path today.
 */
@Injectable()
export class WebhooksEmitter {
  private readonly logger = new Logger(WebhooksEmitter.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly queue: QueueService,
  ) {}

  /**
   * Fan an event out to all matching active subscriptions. Returns the ids of
   * the delivery rows created. Never throws into the caller's flow — a webhook
   * problem must not fail a publish; failures are logged.
   */
  async emit(
    siteId: string,
    event: WebhookEvent | string,
    payload: Record<string, unknown>,
  ): Promise<string[]> {
    try {
      const subs = await this.db
        .select()
        .from(webhooks)
        .where(
          and(eq(webhooks.siteId, siteId), eq(webhooks.active, true), isNull(webhooks.deletedAt)),
        );
      const matching = subs.filter((s) => (s.events ?? []).includes(event));
      if (matching.length === 0) return [];

      const ids: string[] = [];
      for (const sub of matching) {
        const id = await this.enqueueFor(siteId, sub.id, event, payload);
        if (id) ids.push(id);
      }
      return ids;
    } catch (err) {
      this.logger.error(`webhook emit failed (${event}): ${(err as Error).message}`);
      return [];
    }
  }

  /** Create a delivery row for one subscription + enqueue its job. */
  async enqueueFor(
    siteId: string,
    webhookId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<string | null> {
    const envelope = {
      event,
      siteId,
      occurredAt: new Date().toISOString(),
      data: payload,
    };
    const [row] = await this.db
      .insert(webhookDeliveries)
      .values({
        siteId,
        webhookId,
        event,
        payload: envelope,
        status: "pending",
      })
      .returning();
    await this.queue.enqueueWebhookDelivery({ deliveryId: row.id, siteId });
    return row.id;
  }
}

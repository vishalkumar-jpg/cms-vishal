import { randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { webhookDeliveries, webhooks, type WebhookDeliveryRow, type WebhookRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { WebhooksEmitter } from "./webhooks-emitter.service";
import type { CreateWebhookDto, UpdateWebhookDto } from "./dto/webhook.dto";

/** A safe (no-secret) projection of a webhook row for admin listings. */
export type SafeWebhook = Omit<WebhookRow, "secret"> & { hasSecret: boolean };

/**
 * Admin management of webhook subscriptions (E27). Site-scoped + audited
 * (site_admin). Secrets are write-only — listings never echo the secret back,
 * only `hasSecret`. The created subscription's secret is returned ONCE so the
 * subscriber can configure verification.
 */
@Injectable()
export class WebhooksService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly emitter: WebhooksEmitter,
  ) {}

  private safe(row: WebhookRow): SafeWebhook {
    const { secret: _secret, ...rest } = row;
    return { ...rest, hasSecret: !!_secret };
  }

  async list(): Promise<SafeWebhook[]> {
    const rows = await this.repo.db
      .select()
      .from(webhooks)
      .where(this.repo.scope(webhooks))
      .orderBy(desc(webhooks.createdAt))
      .limit(500);
    return rows.map((r) => this.safe(r));
  }

  async get(id: string): Promise<WebhookRow> {
    const [row] = await this.repo.db
      .select()
      .from(webhooks)
      .where(this.repo.scope(webhooks, eq(webhooks.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Webhook not found");
    return row;
  }

  /** Create a subscription. Returns the secret ONCE (alongside the safe row). */
  async create(
    dto: CreateWebhookDto,
    actor: AuthUser,
  ): Promise<SafeWebhook & { secret: string }> {
    const secret = dto.secret?.trim() || `whsec_${randomBytes(24).toString("base64url")}`;
    const [row] = await this.repo.db
      .insert(webhooks)
      .values({
        ...this.repo.insertDefaults(),
        url: dto.url,
        events: dto.events,
        secret,
        active: dto.active ?? true,
      })
      .returning();
    await this.recordAudit(actor, "webhook.created", row.id, { url: row.url, events: row.events });
    return { ...this.safe(row), secret };
  }

  async update(id: string, dto: UpdateWebhookDto, actor: AuthUser): Promise<SafeWebhook> {
    const existing = await this.get(id);
    const patch: Partial<WebhookRow> = { updatedBy: actor.userId };
    if (dto.url !== undefined) patch.url = dto.url;
    if (dto.events !== undefined) patch.events = dto.events;
    if (dto.active !== undefined) patch.active = dto.active;
    if (dto.secret !== undefined && dto.secret.trim()) patch.secret = dto.secret.trim();
    const [row] = await this.repo.db
      .update(webhooks)
      .set(patch)
      .where(this.repo.scope(webhooks, eq(webhooks.id, id)))
      .returning();
    await this.recordAudit(actor, "webhook.updated", existing.id, { fields: Object.keys(dto) });
    return this.safe(row);
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    await this.get(id);
    await this.repo.db
      .update(webhooks)
      .set({ deletedAt: new Date(), active: false, updatedBy: actor.userId })
      .where(this.repo.scope(webhooks, eq(webhooks.id, id)));
    await this.recordAudit(actor, "webhook.deleted", id);
    return { ok: true };
  }

  /** Delivery log for one subscription (most-recent first). */
  async deliveries(id: string): Promise<WebhookDeliveryRow[]> {
    await this.get(id);
    return this.repo.db
      .select()
      .from(webhookDeliveries)
      .where(this.repo.scope(webhookDeliveries, eq(webhookDeliveries.webhookId, id)))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(100);
  }

  /** Send a test event to one subscription — exercises the full delivery path. */
  async sendTest(id: string, actor: AuthUser): Promise<{ deliveryId: string | null }> {
    const sub = await this.get(id);
    const deliveryId = await this.emitter.enqueueFor(this.repo.siteId, sub.id, "webhook.test", {
      message: "This is a test event from OB-CMS.",
      webhookId: sub.id,
    });
    await this.recordAudit(actor, "webhook.tested", sub.id);
    return { deliveryId };
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
      entityType: "webhook",
      entityId,
      metadata,
    });
  }
}

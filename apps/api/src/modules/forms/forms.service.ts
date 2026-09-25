import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { sanitizeText } from "@ob-cms/block-schema";
import {
  formSubmissions,
  forms,
  siteSettings,
  type FormRow,
  type FormSubmissionRow,
} from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import { RedisService } from "@modules/redis/redis.service";
import { formViewsKey } from "./form-views.util";
import { toCsv } from "@utils/csv.utils";
import type {
  CreateFormDto,
  CrmConfigDto,
  FormFieldDto,
  ListSubmissionsQueryDto,
  TriageSubmissionDto,
  UpdateFormDto,
} from "./dto/form.dto";

/**
 * Forms admin surface — CRUD + submissions viewer/export + resend-to-CRM + CRM
 * config (prd/03-forms-runtime-cdn §3.A). Everything is tenant-scoped through
 * the ScopedRepository, so a form/submission can only ever be read/written
 * within its own site (cross-tenant → 404, never leaks existence).
 */
@Injectable()
export class FormsService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
  ) {}

  async list(): Promise<FormRow[]> {
    return this.repo.db
      .select()
      .from(forms)
      .where(this.repo.scope(forms))
      .orderBy(desc(forms.updatedAt))
      .limit(500);
  }

  async get(id: string): Promise<FormRow> {
    const [row] = await this.repo.db
      .select()
      .from(forms)
      .where(this.repo.scope(forms, eq(forms.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Form not found");
    return row;
  }

  async create(dto: CreateFormDto, actor: AuthUser): Promise<FormRow> {
    const name = sanitizeText(dto.name);
    await this.assertNameFree(name);
    const [row] = await this.repo.db
      .insert(forms)
      .values({
        ...this.repo.insertDefaults(),
        name,
        status: "draft",
        fields: this.sanitizeFields(dto.fields) as unknown,
        settings: (dto.settings ?? {}) as unknown,
        crmMapping: (dto.crmMapping ?? {}) as unknown,
      })
      .returning();
    await this.recordAudit(actor, "form.created", row.id, { name });
    return row;
  }

  async update(id: string, dto: UpdateFormDto, actor: AuthUser): Promise<FormRow> {
    const existing = await this.get(id);
    const patch: Partial<FormRow> = { updatedBy: actor.userId };
    if (dto.name !== undefined) {
      const name = sanitizeText(dto.name);
      if (name !== existing.name) await this.assertNameFree(name, id);
      patch.name = name;
    }
    if (dto.fields !== undefined) patch.fields = this.sanitizeFields(dto.fields) as unknown;
    if (dto.settings !== undefined) patch.settings = dto.settings as unknown;
    if (dto.crmMapping !== undefined) patch.crmMapping = dto.crmMapping as unknown;
    const [row] = await this.repo.db
      .update(forms)
      .set(patch)
      .where(this.repo.scope(forms, eq(forms.id, id)))
      .returning();
    await this.recordAudit(actor, "form.updated", id, { fields: Object.keys(dto) });
    return row;
  }

  /** Publish — only published forms accept public submits (FORM-6). editor+. */
  async publish(id: string, actor: AuthUser): Promise<FormRow> {
    await this.get(id);
    const [row] = await this.repo.db
      .update(forms)
      .set({ status: "published", updatedBy: actor.userId })
      .where(this.repo.scope(forms, eq(forms.id, id)))
      .returning();
    await this.recordAudit(actor, "form.published", id);
    return row;
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    await this.get(id);
    await this.repo.db
      .update(forms)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(forms, eq(forms.id, id)));
    await this.recordAudit(actor, "form.deleted", id);
    return { ok: true };
  }

  // -- submissions -----------------------------------------------------------

  async listSubmissions(
    formId: string,
    query: ListSubmissionsQueryDto,
  ): Promise<{
    rows: FormSubmissionRow[];
    page: number;
    pageSize: number;
    total: number;
    unread: number;
    spam: number;
  }> {
    await this.get(formId); // tenant-scoped existence check
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));

    // Base (form-scoped) predicate drives the unfiltered inbox counts.
    const base = this.repo.scope(formSubmissions, eq(formSubmissions.formId, formId));

    // Extra filters (spam / read / date range / text search) narrow the list.
    const filters: SQL[] = [];
    const spam = query.spam ?? "hide";
    if (spam === "hide") filters.push(eq(formSubmissions.isSpam, false));
    else if (spam === "only") filters.push(eq(formSubmissions.isSpam, true));

    if (query.read === "read") filters.push(eq(formSubmissions.isRead, true));
    else if (query.read === "unread") filters.push(eq(formSubmissions.isRead, false));

    const from = query.from ? new Date(query.from) : null;
    if (from && !Number.isNaN(from.getTime())) filters.push(gte(formSubmissions.createdAt, from));
    const to = query.to ? new Date(query.to) : null;
    if (to && !Number.isNaN(to.getTime())) filters.push(lte(formSubmissions.createdAt, to));

    const q = (query.q ?? "").trim();
    if (q) {
      // Case-insensitive substring match over the flattened data jsonb.
      const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      filters.push(sql`${formSubmissions.data}::text ILIKE ${like}`);
    }

    const where = filters.length ? and(base, ...filters) : base;

    const rows = await this.repo.db
      .select()
      .from(formSubmissions)
      .where(where)
      .orderBy(desc(formSubmissions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [filtered] = await this.repo.db
      .select({ count: sql<number>`count(*)::int` })
      .from(formSubmissions)
      .where(where);

    // Inbox counters are over the whole form (not the active filter).
    const [counts] = await this.repo.db
      .select({
        unread: sql<number>`count(*) filter (where not ${formSubmissions.isRead} and not ${formSubmissions.isSpam})::int`,
        spam: sql<number>`count(*) filter (where ${formSubmissions.isSpam})::int`,
      })
      .from(formSubmissions)
      .where(base);

    return {
      rows,
      page,
      pageSize,
      total: Number(filtered?.count ?? 0),
      unread: Number(counts?.unread ?? 0),
      spam: Number(counts?.spam ?? 0),
    };
  }

  /** Triage a submission — mark spam/not-spam and/or read/unread (editor+, audited). */
  async triage(
    submissionId: string,
    dto: TriageSubmissionDto,
    actor: AuthUser,
  ): Promise<FormSubmissionRow> {
    await this.getSubmission(submissionId); // tenant-scoped existence check
    const patch: Partial<FormSubmissionRow> = { updatedBy: actor.userId };
    if (dto.isSpam !== undefined) patch.isSpam = dto.isSpam;
    if (dto.isRead !== undefined) patch.isRead = dto.isRead;
    const [row] = await this.repo.db
      .update(formSubmissions)
      .set(patch)
      .where(this.repo.scope(formSubmissions, eq(formSubmissions.id, submissionId)))
      .returning();
    await this.recordAudit(actor, "form.submission.triaged", submissionId, {
      isSpam: dto.isSpam,
      isRead: dto.isRead,
    });
    return row;
  }

  async getSubmission(submissionId: string): Promise<FormSubmissionRow> {
    const [row] = await this.repo.db
      .select()
      .from(formSubmissions)
      .where(this.repo.scope(formSubmissions, eq(formSubmissions.id, submissionId)))
      .limit(1);
    if (!row) throw new NotFoundException("Submission not found");
    return row;
  }

  /**
   * Submission analytics (FORMS-ADVANCED §analytics). Totals + a daily time
   * series over the last `days` (default 30), spam/delivered breakdown, a recent
   * submissions list, and a views→submissions conversion rate when views were
   * tracked (Redis). Tenant-scoped via the existence check.
   */
  async analytics(
    formId: string,
    days = 30,
  ): Promise<{
    total: number;
    spam: number;
    delivered: number;
    windowDays: number;
    series: Array<{ date: string; count: number }>;
    views: number | null;
    conversionRate: number | null;
    recent: Array<{
      id: string;
      data: Record<string, unknown>;
      status: string;
      isSpam: boolean;
      createdAt: string;
    }>;
  }> {
    await this.get(formId); // tenant-scoped existence check
    const windowDays = Math.min(365, Math.max(1, Number(days) || 30));
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const where = this.repo.scope(formSubmissions, eq(formSubmissions.formId, formId));

    const [totals] = await this.repo.db
      .select({
        total: sql<number>`count(*)::int`,
        spam: sql<number>`count(*) filter (where ${formSubmissions.isSpam})::int`,
        delivered: sql<number>`count(*) filter (where ${formSubmissions.status} = 'delivered')::int`,
      })
      .from(formSubmissions)
      .where(where);

    const seriesRows = await this.repo.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${formSubmissions.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(formSubmissions)
      .where(and(where, gte(formSubmissions.createdAt, since)))
      .groupBy(sql`date_trunc('day', ${formSubmissions.createdAt})`)
      .orderBy(sql`date_trunc('day', ${formSubmissions.createdAt})`);

    const recentRows = await this.repo.db
      .select()
      .from(formSubmissions)
      .where(where)
      .orderBy(desc(formSubmissions.createdAt))
      .limit(10);

    const total = Number(totals?.total ?? 0);
    const views = await this.readViews(formId);
    const conversionRate =
      views && views > 0 ? Math.min(1, Number((total / views).toFixed(4))) : null;

    return {
      total,
      spam: Number(totals?.spam ?? 0),
      delivered: Number(totals?.delivered ?? 0),
      windowDays,
      series: seriesRows.map((r) => ({ date: r.date, count: Number(r.count) })),
      views,
      conversionRate,
      recent: recentRows.map((r) => ({
        id: r.id,
        data: (r.data ?? {}) as Record<string, unknown>,
        status: r.status,
        isSpam: r.isSpam,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /** All-time view counter from Redis (best-effort; null when unavailable). */
  private async readViews(formId: string): Promise<number | null> {
    try {
      const raw = await this.redis.get(formViewsKey(formId));
      if (raw === null) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  /** CSV export — formula-injection-safe via toCsv() (FORM-12). */
  async exportCsv(formId: string): Promise<string> {
    const form = await this.get(formId);
    const fieldNames = this.sanitizeFields(
      (form.fields as FormFieldDto[] | null) ?? undefined,
    ).map((f) => f.name);
    const rows = await this.repo.db
      .select()
      .from(formSubmissions)
      .where(this.repo.scope(formSubmissions, eq(formSubmissions.formId, formId)))
      .orderBy(desc(formSubmissions.createdAt))
      .limit(50000);

    const headers = ["submissionId", "submittedAt", "status", ...fieldNames];
    const records = rows.map((r) => {
      const data = (r.data ?? {}) as Record<string, unknown>;
      const rec: Record<string, unknown> = {
        submissionId: r.id,
        submittedAt: r.createdAt.toISOString(),
        status: r.status,
      };
      for (const name of fieldNames) rec[name] = data[name];
      return rec;
    });
    return toCsv(headers, records);
  }

  /** Re-enqueue CRM delivery for a stored/failed/dead-lettered submission (FORM-17). */
  async resend(submissionId: string, actor: AuthUser): Promise<{ ok: true }> {
    const sub = await this.getSubmission(submissionId);
    if (sub.status === "delivered") {
      throw new BadRequestException("Submission already delivered");
    }
    if (sub.isSpam) {
      throw new BadRequestException("Spam submissions are not delivered");
    }
    await this.repo.db
      .update(formSubmissions)
      .set({ status: "stored", lastError: null, updatedBy: actor.userId })
      .where(this.repo.scope(formSubmissions, eq(formSubmissions.id, submissionId)));
    await this.queue.enqueueCrmDelivery({
      submissionId: sub.id,
      siteId: this.repo.siteId,
      formId: sub.formId,
    });
    await this.recordAudit(actor, "form.submission.resent", submissionId);
    return { ok: true };
  }

  // -- CRM config (site_admin+) ----------------------------------------------

  /** Returns config WITHOUT the secret (write-only). */
  async getCrmConfig(): Promise<{
    crmWebhookUrl: string | null;
    crmDualWrite: boolean;
    crmLegacyUrl: string | null;
    hasSecret: boolean;
  }> {
    const [row] = await this.repo.db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.siteId, this.repo.siteId))
      .limit(1);
    if (!row) throw new NotFoundException("Site settings not found");
    return {
      crmWebhookUrl: row.crmWebhookUrl ?? null,
      crmDualWrite: row.crmDualWrite,
      crmLegacyUrl: row.crmLegacyUrl ?? null,
      hasSecret: Boolean(row.crmHmacSecret),
    };
  }

  async setCrmConfig(dto: CrmConfigDto, actor: AuthUser): Promise<{ ok: true }> {
    const patch: Record<string, unknown> = { updatedBy: actor.userId };
    if (dto.crmWebhookUrl !== undefined) patch.crmWebhookUrl = dto.crmWebhookUrl || null;
    if (dto.crmHmacSecret !== undefined && dto.crmHmacSecret.length > 0) {
      patch.crmHmacSecret = dto.crmHmacSecret;
    }
    if (dto.crmDualWrite !== undefined) patch.crmDualWrite = dto.crmDualWrite;
    if (dto.crmLegacyUrl !== undefined) patch.crmLegacyUrl = dto.crmLegacyUrl || null;
    const res = await this.repo.db
      .update(siteSettings)
      .set(patch)
      .where(eq(siteSettings.siteId, this.repo.siteId))
      .returning({ id: siteSettings.id });
    if (res.length === 0) throw new NotFoundException("Site settings not found");
    // Never log the secret value.
    await this.recordAudit(actor, "form.crm_config.updated", this.repo.siteId, {
      secretRotated: Boolean(patch.crmHmacSecret),
      dualWrite: dto.crmDualWrite,
    });
    return { ok: true };
  }

  // -- helpers ---------------------------------------------------------------

  private sanitizeFields(fields?: FormFieldDto[]): FormFieldDto[] {
    if (!Array.isArray(fields)) return [];
    return fields.slice(0, 200).map((f) => ({
      ...f,
      label: sanitizeText(f.label ?? ""),
      name: this.fieldName(f.name),
      placeholder: f.placeholder ? sanitizeText(f.placeholder) : undefined,
    }));
  }

  private fieldName(name: string): string {
    const clean = String(name ?? "").trim().replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 80);
    if (!clean) throw new BadRequestException("Field name is required");
    return clean;
  }

  private async assertNameFree(name: string, excludeId?: string): Promise<void> {
    const [row] = await this.repo.db
      .select({ id: forms.id })
      .from(forms)
      .where(this.repo.scope(forms, eq(forms.name, name)))
      .limit(1);
    if (row && row.id !== excludeId) {
      throw new ConflictException("A form with this name already exists");
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
      entityType: "form",
      entityId,
      metadata,
    });
  }
}

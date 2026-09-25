import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { sanitizeText } from "@ob-cms/block-schema";
import { WEBHOOK_EVENT } from "@ob-cms/shared";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { formSubmissions, forms, type FormRow } from "@database/schema";
import { RedisService } from "@modules/redis/redis.service";
import { QueueService } from "@modules/queue/queue.service";
import { WebhooksEmitter } from "@modules/webhooks/webhooks-emitter.service";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import { IdentityService } from "@modules/identity/identity.service";
import { WorkflowsService } from "@modules/workflows/workflows.service";
import { CaptchaService } from "./captcha.service";
import { FormNotifyService } from "./form-notify.service";
import { isFieldVisible, type ConditionalRule } from "./conditional-logic";
import {
  FORM_VIEW_DAY_TTL_SECONDS,
  formViewsDayKey,
  formViewsKey,
  utcDay,
} from "./form-views.util";

interface FormField {
  type: string;
  label: string;
  name: string;
  required?: boolean;
  step?: number;
  validation?: { minLength?: number; maxLength?: number; pattern?: string; format?: string };
  options?: Array<{ label: string; value: string }>;
  conditional?: ConditionalRule;
}

interface SubmitMeta {
  ip?: string;
  ua?: string;
  referrer?: string;
}

interface SubmitInput {
  data: Record<string, unknown>;
  honeypot?: string;
  renderedAt?: number;
  utm?: Record<string, unknown>;
  captchaToken?: string;
  /** First-party analytics visitorId (Phase 3 identity link, best-effort). */
  visitorId?: string;
}

const MAX_BODY_BYTES = 64 * 1024;
const MAX_FIELD_LEN = 5000;
const RATE_LIMIT_MAX = 10; // submissions
const RATE_LIMIT_WINDOW = 60; // seconds
const MIN_SUBMIT_MS = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PublicSubmitResult {
  ok: true;
  submissionId: string | null;
  /** "message" → show successMessage; "redirect" → navigate to redirectUrl. */
  successMode: "message" | "redirect";
  successMessage: string;
  redirectUrl?: string;
  spam: boolean;
}

/**
 * PUBLIC form submission (FORM-7..10). @Public route → no auth. The site is
 * resolved SERVER-SIDE from the Host header (NEVER a client-supplied siteId);
 * the form must belong to that site and be published or it's 404. The flow is:
 *
 *   resolve site → load published form → size/spam gate → validate+sanitize
 *   against the form's OWN field schema → PERSIST (the safety net) → enqueue CRM
 *   delivery → respond per settings.
 *
 * The submission is ALWAYS persisted before delivery is enqueued, so a CRM
 * outage never loses a lead. Spam-looking submissions are persisted as `isSpam`
 * (auditable) but never enqueued and return a success-looking response.
 */
@Injectable()
export class PublicFormsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly resolver: SiteResolver,
    private readonly redis: RedisService,
    private readonly queue: QueueService,
    private readonly captcha: CaptchaService,
    private readonly notify: FormNotifyService,
    private readonly webhooks: WebhooksEmitter,
    private readonly identity: IdentityService,
    private readonly workflows: WorkflowsService,
  ) {}

  /** Public form schema for render — fields + settings ONLY (no crmMapping/secret). */
  async getPublicForm(
    host: string | undefined,
    formId: string,
  ): Promise<{
    id: string;
    name: string;
    fields: FormField[];
    settings: Record<string, unknown>;
    captcha: { enabled: boolean; siteKey?: string };
  }> {
    const { form } = await this.resolvePublishedForm(host, formId);
    const settings = (form.settings as Record<string, unknown> | null) ?? {};
    const captchaOn = this.captchaRequired(settings);
    // Track a view for analytics conversion (best-effort, never blocks render).
    void this.trackView(form.id);
    return {
      id: form.id,
      name: form.name,
      fields: ((form.fields as FormField[] | null) ?? []).map((f) => ({
        type: f.type,
        label: f.label,
        name: f.name,
        required: f.required,
        step: f.step,
        validation: f.validation,
        options: f.options,
        conditional: f.conditional,
      })),
      settings,
      captcha: {
        enabled: captchaOn && this.captcha.enabled,
        siteKey: captchaOn ? this.captcha.siteKey : undefined,
      },
    };
  }

  /** Best-effort per-form view counters in Redis (total + per-UTC-day). */
  private async trackView(formId: string): Promise<void> {
    try {
      await this.redis.client.incr(formViewsKey(formId));
      const dayKey = formViewsDayKey(formId, utcDay(new Date()));
      const n = await this.redis.client.incr(dayKey);
      if (n === 1) await this.redis.client.expire(dayKey, FORM_VIEW_DAY_TTL_SECONDS);
    } catch {
      /* analytics is best-effort */
    }
  }

  async submit(
    host: string | undefined,
    formId: string,
    input: SubmitInput,
    meta: SubmitMeta,
  ): Promise<PublicSubmitResult> {
    const rawBytes = Buffer.byteLength(JSON.stringify(input.data ?? {}), "utf8");
    if (rawBytes > MAX_BODY_BYTES) {
      throw new PayloadTooLargeException("Submission payload too large");
    }

    const { site, form } = await this.resolvePublishedForm(host, formId);
    const settings = (form.settings as Record<string, unknown> | null) ?? {};
    const fields = ((form.fields as FormField[] | null) ?? []) as FormField[];

    // --- captcha (Turnstile) — only when the form opts in AND a secret is set -
    // When no secret is configured we fall through to the honeypot/timing gates.
    if (this.captchaRequired(settings) && this.captcha.enabled) {
      const ok = await this.captcha.verify(input.captchaToken, meta.ip);
      if (!ok) throw new BadRequestException("Captcha verification failed");
    }

    // --- spam gates (honeypot + timing + per-IP/form rate limit) -------------
    let spam = false;
    if (input.honeypot && input.honeypot.trim().length > 0) spam = true;
    const minMs = this.minSubmitMs(settings);
    if (!spam && input.renderedAt && Date.now() - Number(input.renderedAt) < minMs) spam = true;
    if (!spam && !(await this.allowRate(form.id, meta.ip))) spam = true;

    // --- drop fields hidden by conditional logic (server re-evaluates rules) --
    // A hidden-by-conditional-logic field cannot be injected via a crafted POST.
    const visibleFields = fields.filter((f) => isFieldVisible(f.conditional, input.data ?? {}));

    // --- validate + sanitize against the form's OWN (visible) schema ----------
    const cleanData = spam ? {} : this.validateAndSanitize(visibleFields, input.data ?? {});

    // --- ALWAYS persist first (the safety net) -------------------------------
    const idempotencyKey = `fsb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const [row] = await this.db
      .insert(formSubmissions)
      .values({
        siteId: site.id,
        formId: form.id,
        data: cleanData as unknown,
        meta: {
          ip: meta.ip,
          ua: meta.ua ? sanitizeText(meta.ua).slice(0, 500) : undefined,
          referrer: meta.referrer ? sanitizeText(meta.referrer).slice(0, 1000) : undefined,
          utm: input.utm ?? undefined,
        } as unknown,
        status: "stored",
        isSpam: spam,
        idempotencyKey,
      })
      .returning();

    // The persisted idempotencyKey IS the submission id contract; align them.
    await this.db
      .update(formSubmissions)
      .set({ idempotencyKey: row.id })
      .where(eq(formSubmissions.id, row.id));

    // --- enqueue delivery + fan out a notification email (non-spam only) -----
    // CRM delivery is async (the worker); the notification email is sent inline
    // (best-effort) and NEVER disturbs CRM delivery.
    if (!spam) {
      await this.queue.enqueueCrmDelivery({
        submissionId: row.id,
        siteId: site.id,
        formId: form.id,
      });
      void this.notify.notify({
        notifyEmails: settings.notifyEmails,
        formName: form.name,
        submissionId: row.id,
        fields: visibleFields.map((f) => ({ label: f.label, name: f.name })),
        data: cleanData,
      });
      // E27: outbound webhook (best-effort; never disturbs submit/CRM/notify).
      void this.webhooks.emit(site.id, WEBHOOK_EVENT.FORM_SUBMITTED, {
        submissionId: row.id,
        formId: form.id,
        formName: form.name,
        fields: cleanData,
      });
      // PHASE-3: identity link (best-effort). If the form has an email field and
      // the submit carried a visitorId, link email → visitorId (upserts an
      // identity + business-domain company). Never disturbs the submit path.
      const emailField = visibleFields.find((f) => f.type === "email");
      const email = emailField ? (cleanData as Record<string, unknown>)[emailField.name] : undefined;
      if (input.visitorId && typeof email === "string" && email.includes("@")) {
        const nameField = visibleFields.find((f) => f.name === "name" || f.type === "name");
        const name = nameField ? (cleanData as Record<string, unknown>)[nameField.name] : undefined;
        void this.identity
          .linkEmail(site.id, input.visitorId, email, typeof name === "string" ? name : undefined)
          .catch(() => {
            /* identity linking is best-effort */
          });
      }
      // PHASE-5: workflow trigger (best-effort, non-invasive). Fire any active
      // `form_submitted` workflow whose config.formId matches this form (or is
      // unset = any form). Fully tolerant of a missing visitorId / an executor
      // failure — it NEVER throws into or disturbs the submit path.
      if (input.visitorId) {
        void this.workflows
          .enqueueForTrigger(
            site.id,
            "form_submitted",
            { visitorId: input.visitorId, subjectType: "visitor" },
            (cfg) => !cfg.formId || cfg.formId === form.id,
          )
          .catch(() => {
            /* workflow enqueue is best-effort */
          });
      }
    }

    // --- success directive (FORMS-ADVANCED §thank-you/redirect) --------------
    const successMode: "message" | "redirect" =
      settings.successMode === "redirect" &&
      typeof settings.redirectUrl === "string" &&
      settings.redirectUrl.length > 0
        ? "redirect"
        : "message";

    return {
      ok: true,
      submissionId: spam ? null : row.id,
      successMode,
      successMessage:
        (typeof settings.successMessage === "string" && settings.successMessage) ||
        "Thanks — your submission was received.",
      redirectUrl:
        successMode === "redirect" && typeof settings.redirectUrl === "string"
          ? settings.redirectUrl
          : undefined,
      spam,
    };
  }

  /** A form requires captcha when settings.spamProtection.captcha === true. */
  private captchaRequired(settings: Record<string, unknown>): boolean {
    const sp = settings.spamProtection as { captcha?: boolean } | undefined;
    return sp?.captcha === true;
  }

  // -- helpers ---------------------------------------------------------------

  /** Resolve host→site server-side, then the published form scoped to THAT site. */
  private async resolvePublishedForm(
    host: string | undefined,
    formId: string,
  ): Promise<{ site: { id: string }; form: FormRow }> {
    const site = await this.resolver.resolve(host);
    if (!site) throw new NotFoundException("Site not found for host");
    const [form] = await this.db
      .select()
      .from(forms)
      .where(
        and(
          eq(forms.id, formId),
          eq(forms.siteId, site.id),
          eq(forms.status, "published"),
          isNull(forms.deletedAt),
        ),
      )
      .limit(1);
    if (!form) throw new NotFoundException("Form not found");
    return { site, form };
  }

  private minSubmitMs(settings: Record<string, unknown>): number {
    const sp = settings.spamProtection as { minSubmitSeconds?: number } | undefined;
    const secs = sp?.minSubmitSeconds;
    return typeof secs === "number" && secs > 0 ? secs * 1000 : MIN_SUBMIT_MS;
  }

  /** Redis token bucket per (form, ip). Best-effort: a cache outage allows. */
  private async allowRate(formId: string, ip?: string): Promise<boolean> {
    if (!ip) return true;
    const key = `formrate:${formId}:${ip}`;
    try {
      const count = await this.redis.client.incr(key);
      if (count === 1) await this.redis.client.expire(key, RATE_LIMIT_WINDOW);
      return count <= RATE_LIMIT_MAX;
    } catch {
      return true;
    }
  }

  /**
   * Validate the submitted data against the form's field definitions and return
   * a sanitized bag keyed ONLY by known field names. Unknown keys are dropped;
   * required/format/length rules are enforced server-side (422 on violation).
   */
  private validateAndSanitize(
    fields: FormField[],
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const field of fields) {
      const raw = data[field.name];
      const provided = raw !== undefined && raw !== null && String(raw).length > 0;

      if (!provided) {
        if (field.required && field.type !== "hidden") {
          errors.push(`${field.name} is required`);
        }
        continue;
      }

      let value: unknown = raw;
      if (typeof raw === "string") {
        const trimmed = raw.slice(0, MAX_FIELD_LEN);
        // file = our own presigned S3/MinIO URL; consent/checkbox = raw token.
        value =
          field.type === "consent" || field.type === "checkbox" || field.type === "file"
            ? trimmed
            : sanitizeText(trimmed);
      } else if (Array.isArray(raw)) {
        value = raw.slice(0, 100).map((v) => sanitizeText(String(v)).slice(0, MAX_FIELD_LEN));
      } else if (typeof raw === "boolean" || typeof raw === "number") {
        value = raw;
      } else {
        value = sanitizeText(String(raw)).slice(0, MAX_FIELD_LEN);
      }

      const strVal = typeof value === "string" ? value : "";
      if (field.type === "email" && strVal && !EMAIL_RE.test(strVal)) {
        errors.push(`${field.name} must be a valid email`);
        continue;
      }
      const v = field.validation;
      if (v && typeof value === "string") {
        if (v.minLength != null && value.length < v.minLength) errors.push(`${field.name} too short`);
        if (v.maxLength != null && value.length > v.maxLength) errors.push(`${field.name} too long`);
        if (v.pattern) {
          try {
            if (!new RegExp(v.pattern).test(value)) errors.push(`${field.name} is invalid`);
          } catch {
            /* ignore a bad author-supplied pattern */
          }
        }
      }
      out[field.name] = value;
    }

    if (errors.length > 0) {
      throw new UnprocessableEntityException({ message: "Validation failed", errors });
    }
    if (Object.keys(out).length === 0) {
      throw new BadRequestException("Submission contained no valid fields");
    }
    return out;
  }
}

import { boolean, index, integer, jsonb, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `forms` (prefix `frm`) — a marketer-authored form (FORM-1..6,
 * prd/03-forms-runtime-cdn §3.A). Tenant-scoped (`siteId`). `fields` holds the
 * typed field definitions; `settings` post-submit behaviour + spam protection;
 * `crmMapping` maps a field → CRM property (never exposed on the public schema).
 *
 * - `status` ∈ draft | published. Only published forms accept public submits.
 * - UNIQUE(siteId, name) — form names are unique per site.
 *
 * FormField  = { type, label, name, required, placeholder?,
 *                validation?: { minLength?, maxLength?, pattern?, format? },
 *                options?: {label,value}[], conditional?: { field, op, value } }
 * FormSettings = { submitLabel?, successMessage?, redirectUrl?,
 *                  crmWebhookOverride?, doubleOptIn?,
 *                  spamProtection?: { honeypot?, minSubmitSeconds?, captcha? },
 *                  consent?: { required, text } }
 */
export const forms = obCmsSchema.table(
  "forms",
  {
    ...baseColumns("frm"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    status: varchar({ length: 20 }).notNull().default("draft"), // draft | published
    fields: jsonb().notNull().default([]),
    settings: jsonb().notNull().default({}),
    crmMapping: jsonb().notNull().default({}),
  },
  (t) => [
    unique("frm_site_name_uq").on(t.siteId, t.name),
    index("frm_site_status_idx").on(t.siteId, t.status),
  ],
);

export type FormRow = typeof forms.$inferSelect;
export type NewFormRow = typeof forms.$inferInsert;

/**
 * `formSubmissions` (prefix `fsb`) — THE SAFETY NET (FORM-10). Every valid
 * submission is persisted here BEFORE any CRM delivery is attempted, so a lead
 * is never lost even if the CRM is down. We extend the reference shape with the
 * delivery state-machine columns (status/attempts/lastError/deliveredAt).
 *
 * - `data` = validated field values; `meta` = { ip, ua, referrer, utm, pageUrl }.
 * - `status` ∈ stored | delivering | delivered | failed | dead_lettered.
 * - `idempotencyKey` = the submission id, sent to the CRM so retries never
 *   create duplicate leads (FORM-18). UNIQUE.
 * - `isSpam` rows are persisted (auditable) but never enqueued for delivery.
 */
export const formSubmissions = obCmsSchema.table(
  "form_submissions",
  {
    ...baseColumns("fsb"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    formId: varchar({ length: 50 })
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    data: jsonb().notNull().default({}),
    meta: jsonb().notNull().default({}),
    status: varchar({ length: 20 }).notNull().default("stored"), // stored|delivering|delivered|failed|dead_lettered
    deliveryAttempts: integer().notNull().default(0),
    lastError: varchar({ length: 1000 }),
    deliveredAt: timestamp({ withTimezone: true }),
    idempotencyKey: varchar({ length: 60 }),
    isSpam: boolean().notNull().default(false),
    // Submissions inbox triage: read/unread flag (independent of delivery status).
    isRead: boolean().notNull().default(false),
  },
  (t) => [
    index("fsb_site_form_idx").on(t.siteId, t.formId, t.createdAt),
    index("fsb_status_idx").on(t.status),
    unique("fsb_idempotency_uq").on(t.idempotencyKey),
    // WAVE4b: CRM sweeper scans stuck submissions per-site by status + age.
    index("fsb_site_status_created_idx").on(t.siteId, t.status, t.createdAt),
  ],
);

export type FormSubmissionRow = typeof formSubmissions.$inferSelect;
export type NewFormSubmissionRow = typeof formSubmissions.$inferInsert;

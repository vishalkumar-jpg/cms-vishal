/**
 * Forms manager types. Mirror the apps/api forms module DTOs exactly so the
 * admin client and server stay in lockstep.
 */

export const FORM_FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "textarea",
  "select",
  "multiselect",
  "radio",
  "checkbox",
  "number",
  "date",
  "hidden",
  "consent",
  "file",
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const CONDITIONAL_OPS = [
  "equals",
  "notEquals",
  "contains",
  "notEmpty",
  "empty",
] as const;
export type ConditionalOp = (typeof CONDITIONAL_OPS)[number];

/** Per-field show/hide rule. The field is visible only when the rule passes. */
export interface ConditionalRule {
  field?: string;
  op?: ConditionalOp;
  value?: string;
}

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

export interface FormField {
  type: FormFieldType;
  label: string;
  name: string;
  required?: boolean;
  /** 0-based step index for multi-step forms. */
  step?: number;
  placeholder?: string;
  validation?: FormFieldValidation;
  options?: FormFieldOption[];
  conditional?: ConditionalRule;
}

/** Post-submit behaviour + spam/notify config persisted on `form.settings`. */
export interface FormSettings {
  submitLabel?: string;
  successMode?: "message" | "redirect";
  successMessage?: string;
  redirectUrl?: string;
  notifyEmails?: string[];
  steps?: string[];
  spamProtection?: {
    honeypot?: boolean;
    minSubmitSeconds?: number;
    captcha?: boolean;
  };
}

export type FormStatus = "draft" | "published" | "archived";

export interface Form {
  id: string;
  siteId: string;
  name: string;
  status: FormStatus;
  fields: FormField[];
  settings: Record<string, unknown>;
  crmMapping: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** List-row view of a form (same shape as `Form`; alias kept for intent). */
export type FormSummary = Form;

/** Meta captured at submit-time (ip/ua/referrer/utm + optional visitor link). */
export interface FormSubmissionMeta {
  ip?: string;
  ua?: string;
  referrer?: string;
  utm?: Record<string, unknown>;
  pageUrl?: string;
  /** Phase 3 identity link (present only when the submit carried a visitorId). */
  visitorId?: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  meta?: FormSubmissionMeta;
  status: string;
  createdAt: string;
  isSpam?: boolean;
  isRead?: boolean;
}

/** Filters for the submissions inbox list query. */
export interface SubmissionFilters {
  spam: "hide" | "only" | "all";
  read: "read" | "unread" | "all";
  from: string | null;
  to: string | null;
  q: string;
}

export interface SubmissionsPage {
  rows: FormSubmission[];
  page: number;
  pageSize: number;
  total: number;
  /** Whole-form counters (not filtered): unread (non-spam) + spam. */
  unread: number;
  spam: number;
}

export interface TriagePayload {
  isSpam?: boolean;
  isRead?: boolean;
}

export interface FormAnalytics {
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
}

export interface CrmConfig {
  crmWebhookUrl: string | null;
  crmDualWrite: boolean;
  crmLegacyUrl: string | null;
  hasSecret: boolean;
}

export interface CreateFormPayload {
  name: string;
  fields?: FormField[];
  settings?: FormSettings;
  crmMapping?: Record<string, string>;
}

export interface UpdateFormPayload {
  name?: string;
  fields?: FormField[];
  settings?: FormSettings;
  crmMapping?: Record<string, string>;
}

export interface CrmConfigPayload {
  crmWebhookUrl?: string;
  crmHmacSecret?: string;
  crmDualWrite?: boolean;
  crmLegacyUrl?: string;
}

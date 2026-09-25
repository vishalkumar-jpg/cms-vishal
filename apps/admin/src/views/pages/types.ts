import type { SerializedLayout, PageLayoutOptions } from "@ob-cms/block-schema";

/**
 * Page shapes (Wave 2). These mirror the API `pages` table (Wave 2b builds the
 * endpoints in parallel). Defined locally until the Orval SDK is regenerated;
 * swapping to generated types is a localized change.
 */
export const PAGE_STATUSES = ["draft", "published", "scheduled", "archived"] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

/** B14 editorial workflow states (draft → in_review → approved → published). */
export const WORKFLOW_STATES = ["draft", "in_review", "approved", "published"] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export interface PageSeoMeta {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

/** Per-page chrome inheritance controls (mirrors pages.layout_options). */
export type { PageLayoutOptions } from "@ob-cms/block-schema";

/** Full page row (list + detail). */
export interface Page {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  status: PageStatus;
  /** i18n (B13): this row's locale + translation group id. Optional for back-compat. */
  locale?: string;
  translationKey?: string | null;
  /** B14 workflow state. Optional for back-compat with cached/older payloads. */
  workflowState?: WorkflowState;
  reviewerId?: string | null;
  reviewNote?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  draftLayout: SerializedLayout | null;
  publishedLayout: SerializedLayout | null;
  seo: PageSeoMeta;
  /** Chrome inheritance + hide flags for topbar/navbar/footer. */
  layoutOptions?: PageLayoutOptions;
  parentId: string | null;
  schemaVersion: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  /** CONTENT-OPS: when this page auto-unpublishes (null = never). */
  expiresAt?: string | null;
  /** Phase 3: template provenance (display-only; null when not from a template). */
  sourceTemplateId?: string | null;
  sourceTemplateKey?: string | null;
  sourceTemplateVersion?: string | null;
  instantiatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** List item (layouts omitted for list views). */
export type PageSummary = Omit<Page, "draftLayout" | "publishedLayout">;

/** GET /pages query — B14 adds workflow-state + review-queue filters. */
export interface ListPagesQuery {
  status?: PageStatus;
  state?: WorkflowState;
  assignedTo?: string;
  q?: string;
  /** i18n (B13): narrow to a single locale's pages. */
  locale?: string;
}

/** POST /pages/:id/translations body (i18n B13). */
export interface CreateTranslationPayload {
  locale: string;
  slug?: string;
}

export interface CreatePagePayload {
  title: string;
  slug: string;
  parentId?: string | null;
}

/** POST /pages/from-template — create a draft page from a published skeleton. */
export interface CreatePageFromTemplatePayload {
  title: string;
  slug: string;
  skeletonId: string;
  parentId?: string;
  seo?: PageSeoMeta;
}

export interface UpdatePagePayload {
  title?: string;
  slug?: string;
  status?: PageStatus;
  seo?: PageSeoMeta;
  parentId?: string | null;
  layoutOptions?: PageLayoutOptions;
  /** CONTENT-OPS: set an expiry (ISO) or clear it (null). Omit to leave as-is. */
  expiresAt?: string | null;
}

/** CONTENT-OPS: response of POST /pages/:id/preview-link. */
export interface PreviewLink {
  url: string;
  token: string;
}

/** CONTENT-OPS: advisory edit-lock state (GET/POST {pages,posts}/:id/lock). */
export interface LockView {
  locked: boolean;
  holder: {
    userId: string;
    userName: string;
    acquiredAt: string;
    heartbeatAt: string;
  } | null;
  mine: boolean;
}

export interface SaveDraftPayload {
  /** The API's SaveDraftDto field is `layout` (saved into the page's draftLayout). */
  layout: SerializedLayout;
  seo?: PageSeoMeta;
}

/** POST /pages/:id/schedule body (SchedulePageDto). */
export interface SchedulePayload {
  scheduledAt: string;
}

/** A snapshot row from GET /pages/:id/versions. */
export interface PageVersion {
  id: string;
  pageId: string;
  version?: number;
  label?: string | null;
  createdAt: string;
  createdBy?: string | null;
  /**
   * The layout/seo snapshot captured at publish time. The versions endpoint
   * returns the full row (including this), so version diff/compare can run
   * entirely client-side without a dedicated compare endpoint.
   */
  snapshot?: { layout?: SerializedLayout | null; seo?: unknown } | null;
}

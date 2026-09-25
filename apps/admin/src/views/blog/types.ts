/**
 * Blog (posts) shapes. Mirrors the apps/api blog module (controller base
 * `/posts`). Site-scoped via the X-Site-Id header, so the client never sends a
 * siteId in the path/body. Kept local until the Orval SDK is regenerated.
 */
export const POST_STATUSES = ["draft", "published", "scheduled", "archived"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** B14 editorial workflow states (draft → in_review → approved → published). */
export const WORKFLOW_STATES = ["draft", "in_review", "approved", "published"] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export interface PostSeo {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

export interface PostTerm {
  kind: "category" | "tag";
  name: string;
}

/** Full post row (list + detail). Extra/unknown API fields tolerated loosely. */
export interface Post {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: PostStatus;
  /** i18n (B13): this row's locale + translation group id. Optional for back-compat. */
  locale?: string;
  translationKey?: string | null;
  /** B14 workflow state. Optional for back-compat with cached/older payloads. */
  workflowState?: WorkflowState;
  reviewerId?: string | null;
  reviewNote?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  coverMediaId: string | null;
  layout: Record<string, unknown> | null;
  seo: Record<string, unknown> | null;
  publishedAt: string | null;
  scheduledAt?: string | null;
  /** CONTENT-OPS: when this post auto-unpublishes (null = never). */
  expiresAt?: string | null;
  terms?: PostTerm[];
  createdAt: string;
  updatedAt: string;
}

/** List item (layout omitted for list views). */
export type PostSummary = Omit<Post, "layout">;

export interface CreatePostPayload {
  title: string;
  slug: string;
  excerpt?: string;
  layout?: Record<string, unknown>;
  coverMediaId?: string;
  seo?: PostSeo;
  terms?: PostTerm[];
}

export interface UpdatePostPayload {
  title?: string;
  slug?: string;
  excerpt?: string;
  layout?: Record<string, unknown>;
  coverMediaId?: string;
  seo?: PostSeo;
  terms?: PostTerm[];
  status?: PostStatus;
  /** CONTENT-OPS: set an expiry (ISO) or clear it (null). */
  expiresAt?: string | null;
}

/** CONTENT-OPS: response of POST /posts/:id/preview-link. */
export interface PreviewLink {
  url: string;
  token: string;
}

export interface ListPostsQuery {
  status?: PostStatus;
  state?: WorkflowState;
  assignedTo?: string;
  category?: string;
  tag?: string;
  q?: string;
  trashed?: boolean;
  /** i18n (B13): narrow to a single locale's posts. */
  locale?: string;
}

/** POST /posts/:id/translations body (i18n B13). */
export interface CreateTranslationPayload {
  locale: string;
  slug?: string;
}

/** Aggregated taxonomy term returned by GET /posts/terms. */
export interface TermSummary {
  kind: "category" | "tag";
  name: string;
  slug: string;
  count: number;
}

export interface BulkResult {
  count: number;
}

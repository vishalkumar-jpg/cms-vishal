import { request } from "@/services/AxiosService";
import type {
  BulkResult,
  CreatePostPayload,
  CreateTranslationPayload,
  ListPostsQuery,
  Post,
  PostSummary,
  PreviewLink,
  TermSummary,
  UpdatePostPayload,
} from "../types";

/**
 * Raw blog (posts) API calls. Site-scoped via the X-Site-Id header (Axios
 * mutator), so paths are relative: `/posts`, never `/sites/:id/posts`.
 */
export const listPostsRequest = (query?: ListPostsQuery): Promise<Post[]> =>
  request<Post[]>({ url: `/posts`, method: "GET", params: query });

export const getPostRequest = (id: string): Promise<Post> =>
  request<Post>({ url: `/posts/${id}`, method: "GET" });

export const createPostRequest = (payload: CreatePostPayload): Promise<Post> =>
  request<Post>({ url: `/posts`, method: "POST", data: payload });

export const updatePostRequest = (id: string, payload: UpdatePostPayload): Promise<Post> =>
  request<Post>({ url: `/posts/${id}`, method: "PATCH", data: payload });

export const publishPostRequest = (id: string): Promise<Post> =>
  request<Post>({ url: `/posts/${id}/publish`, method: "POST" });

export const schedulePostRequest = (id: string, scheduledAt: string): Promise<Post> =>
  request<Post>({ url: `/posts/${id}/schedule`, method: "POST", data: { scheduledAt } });

// -- B14 editorial workflow -------------------------------------------------
export const submitPostReviewRequest = (id: string, reviewerId?: string): Promise<Post> =>
  request<Post>({
    url: `/posts/${id}/submit-review`,
    method: "POST",
    data: reviewerId ? { reviewerId } : {},
  });

export const approvePostRequest = (id: string, note?: string): Promise<Post> =>
  request<Post>({ url: `/posts/${id}/approve`, method: "POST", data: note ? { note } : {} });

export const rejectPostRequest = (id: string, note: string): Promise<Post> =>
  request<Post>({ url: `/posts/${id}/reject`, method: "POST", data: { note } });

export const deletePostRequest = (id: string): Promise<{ ok: true }> =>
  request<{ ok: true }>({ url: `/posts/${id}`, method: "DELETE" });

/** Autosave only the draft layout (visual builder). */
export const savePostLayoutRequest = (
  id: string,
  layout: Record<string, unknown>,
): Promise<Post> =>
  request<Post>({ url: `/posts/${id}/layout`, method: "PUT", data: { layout } });

export const restorePostRequest = (id: string): Promise<Post> =>
  request<Post>({ url: `/posts/${id}/restore`, method: "POST" });

/** CONTENT-OPS: mint a shareable no-login draft preview link. */
export const createPostPreviewLinkRequest = (id: string): Promise<PreviewLink> =>
  request<PreviewLink>({ url: `/posts/${id}/preview-link`, method: "POST" });

/** CONTENT-OPS: revoke all preview links for a post. */
export const revokePostPreviewLinkRequest = (id: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `/posts/${id}/preview-link`, method: "DELETE" });

// -- i18n / localization (B13) ------------------------------------------------
export const listPostTranslationsRequest = (id: string): Promise<PostSummary[]> =>
  request<PostSummary[]>({ url: `/posts/${id}/translations`, method: "GET" });

export const createPostTranslationRequest = (
  id: string,
  payload: CreateTranslationPayload,
): Promise<Post> =>
  request<Post>({ url: `/posts/${id}/translations`, method: "POST", data: payload });

export const destroyPostRequest = (id: string): Promise<{ ok: true }> =>
  request<{ ok: true }>({ url: `/posts/${id}/permanent`, method: "DELETE" });

// -- bulk -------------------------------------------------------------------
export const bulkPublishRequest = (ids: string[]): Promise<BulkResult> =>
  request<BulkResult>({ url: `/posts/bulk/publish`, method: "POST", data: { ids } });

export const bulkTrashRequest = (ids: string[]): Promise<BulkResult> =>
  request<BulkResult>({ url: `/posts/bulk/trash`, method: "POST", data: { ids } });

export const bulkRestoreRequest = (ids: string[]): Promise<BulkResult> =>
  request<BulkResult>({ url: `/posts/bulk/restore`, method: "POST", data: { ids } });

// -- taxonomy ---------------------------------------------------------------
export const listTermsRequest = (kind?: "category" | "tag"): Promise<TermSummary[]> =>
  request<TermSummary[]>({ url: `/posts/terms`, method: "GET", params: kind ? { kind } : undefined });

export const createTermRequest = (kind: "category" | "tag", name: string): Promise<TermSummary> =>
  request<TermSummary>({ url: `/posts/terms`, method: "POST", data: { kind, name } });

export const updateTermRequest = (
  kind: string,
  slug: string,
  name: string,
): Promise<TermSummary> =>
  request<TermSummary>({ url: `/posts/terms/${kind}/${slug}`, method: "PATCH", data: { name } });

export const deleteTermRequest = (kind: string, slug: string): Promise<{ ok: true }> =>
  request<{ ok: true }>({ url: `/posts/terms/${kind}/${slug}`, method: "DELETE" });

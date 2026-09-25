import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  approvePostRequest,
  bulkPublishRequest,
  bulkRestoreRequest,
  bulkTrashRequest,
  createPostRequest,
  createPostTranslationRequest,
  createTermRequest,
  deletePostRequest,
  deleteTermRequest,
  destroyPostRequest,
  getPostRequest,
  listPostsRequest,
  listTermsRequest,
  publishPostRequest,
  rejectPostRequest,
  restorePostRequest,
  schedulePostRequest,
  submitPostReviewRequest,
  updatePostRequest,
  updateTermRequest,
} from "../api/blog.api";
import type {
  BulkResult,
  CreatePostPayload,
  CreateTranslationPayload,
  ListPostsQuery,
  Post,
  TermSummary,
  UpdatePostPayload,
} from "../types";

export const usePosts = (query?: ListPostsQuery) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Post[]>({
    queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId, query ?? {}],
    queryFn: () => listPostsRequest(query),
    enabled: !!siteId,
  });
};

export const usePost = (id: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Post>({
    queryKey: [ADMIN_QUERY_KEYS.POST, siteId, id],
    queryFn: () => getPostRequest(id as string),
    enabled: !!siteId && !!id,
  });
};

export const useCreatePost = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Post, unknown, CreatePostPayload>({
    mutationFn: (payload) => createPostRequest(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] }),
  });
};

export const useUpdatePost = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Post, unknown, { id: string; payload: UpdatePostPayload }>({
    mutationFn: ({ id, payload }) => updatePostRequest(id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POST, siteId, id] });
    },
  });
};

export const usePublishPost = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Post, unknown, string>({
    mutationFn: (id) => publishPostRequest(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POST, siteId, id] });
    },
  });
};

/** B14: submit a draft post for review (optionally assigning a reviewer). */
export const useSubmitPostReview = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Post, unknown, { id: string; reviewerId?: string }>({
    mutationFn: ({ id, reviewerId }) => submitPostReviewRequest(id, reviewerId),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POST, siteId, id] });
    },
  });
};

/** B14: approve a post in review (in_review → approved). Editor+ only. */
export const useApprovePost = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Post, unknown, { id: string; note?: string }>({
    mutationFn: ({ id, note }) => approvePostRequest(id, note),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POST, siteId, id] });
    },
  });
};

/** B14: reject a post back to draft with a note (in_review → draft). Editor+ only. */
export const useRejectPost = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Post, unknown, { id: string; note: string }>({
    mutationFn: ({ id, note }) => rejectPostRequest(id, note),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POST, siteId, id] });
    },
  });
};

export const useDeletePost = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: true }, unknown, string>({
    mutationFn: (id) => deletePostRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] }),
  });
};

export const useSchedulePost = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Post, unknown, { id: string; scheduledAt: string }>({
    mutationFn: ({ id, scheduledAt }) => schedulePostRequest(id, scheduledAt),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POST, siteId, id] });
    },
  });
};

export const useRestorePost = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Post, unknown, string>({
    mutationFn: (id) => restorePostRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] }),
  });
};

export const useDestroyPost = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: true }, unknown, string>({
    mutationFn: (id) => destroyPostRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] }),
  });
};

// -- i18n / localization (B13) ------------------------------------------------

/** Create a translation of a post; returns the new (draft) translation row. */
export const useCreatePostTranslation = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Post, unknown, { id: string; payload: CreateTranslationPayload }>({
    mutationFn: ({ id, payload }) => createPostTranslationRequest(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] }),
  });
};

type BulkOp = "publish" | "trash" | "restore";
const BULK_FN: Record<BulkOp, (ids: string[]) => Promise<BulkResult>> = {
  publish: bulkPublishRequest,
  trash: bulkTrashRequest,
  restore: bulkRestoreRequest,
};

export const useBulkPosts = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<BulkResult, unknown, { op: BulkOp; ids: string[] }>({
    mutationFn: ({ op, ids }) => BULK_FN[op](ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] }),
  });
};

// -- taxonomy ---------------------------------------------------------------

export const useTerms = (kind?: "category" | "tag") => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<TermSummary[]>({
    queryKey: [ADMIN_QUERY_KEYS.POST_TERMS, siteId, kind ?? "all"],
    queryFn: () => listTermsRequest(kind),
    enabled: !!siteId,
  });
};

export const useCreateTerm = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<TermSummary, unknown, { kind: "category" | "tag"; name: string }>({
    mutationFn: ({ kind, name }) => createTermRequest(kind, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POST_TERMS, siteId] }),
  });
};

export const useUpdateTerm = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<TermSummary, unknown, { kind: string; slug: string; name: string }>({
    mutationFn: ({ kind, slug, name }) => updateTermRequest(kind, slug, name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POST_TERMS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] });
    },
  });
};

export const useDeleteTerm = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: true }, unknown, { kind: string; slug: string }>({
    mutationFn: ({ kind, slug }) => deleteTermRequest(kind, slug),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POST_TERMS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.POSTS, siteId] });
    },
  });
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import {
  createCommentRequest,
  deleteCommentRequest,
  listCommentsRequest,
  replyCommentRequest,
  resolveCommentRequest,
  type CommentRow,
  type CreateCommentPayload,
} from "./comments.api";

/**
 * Wrapped comment hooks. Live-ish: the list refetches on window focus and polls
 * on a slow interval so a second editor's threads show up without a reload.
 */
export const usePageComments = (
  siteId: string | null,
  pageId: string | null,
  enabled = true,
) =>
  useQuery<CommentRow[]>({
    queryKey: [ADMIN_QUERY_KEYS.PAGE_COMMENTS, siteId, pageId],
    queryFn: () => listCommentsRequest(pageId as string),
    enabled: !!siteId && !!pageId && enabled,
    refetchOnWindowFocus: true,
    refetchInterval: 20_000,
  });

const useInvalidate = (siteId: string | null, pageId: string | null): (() => void) => {
  const qc = useQueryClient();
  return () =>
    void qc.invalidateQueries({
      queryKey: [ADMIN_QUERY_KEYS.PAGE_COMMENTS, siteId, pageId],
    });
};

export const useCreateComment = (siteId: string | null, pageId: string | null) => {
  const invalidate = useInvalidate(siteId, pageId);
  return useMutation({
    mutationFn: (payload: CreateCommentPayload) => createCommentRequest(payload),
    onSuccess: invalidate,
  });
};

export const useReplyComment = (siteId: string | null, pageId: string | null) => {
  const invalidate = useInvalidate(siteId, pageId);
  return useMutation({
    mutationFn: ({ rootId, body }: { rootId: string; body: string }) =>
      replyCommentRequest(rootId, body),
    onSuccess: invalidate,
  });
};

export const useResolveComment = (siteId: string | null, pageId: string | null) => {
  const invalidate = useInvalidate(siteId, pageId);
  return useMutation({
    mutationFn: ({ rootId, resolved }: { rootId: string; resolved: boolean }) =>
      resolveCommentRequest(rootId, resolved),
    onSuccess: invalidate,
  });
};

export const useDeleteComment = (siteId: string | null, pageId: string | null) => {
  const invalidate = useInvalidate(siteId, pageId);
  return useMutation({
    mutationFn: (id: string) => deleteCommentRequest(id),
    onSuccess: invalidate,
  });
};

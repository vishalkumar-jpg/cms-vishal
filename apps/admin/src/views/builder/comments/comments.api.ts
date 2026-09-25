import { request } from "@/services/AxiosService";

/**
 * A builder comment as returned by the API. A row is either a thread root
 * (`parentId` null) or a reply (`parentId` → the root id). A root anchors to a
 * Craft `nodeId` OR to a canvas point (`anchorX`/`anchorY`, 0..1 fractions).
 */
export interface CommentRow {
  id: string;
  siteId: string;
  pageId: string;
  threadId: string;
  parentId: string | null;
  nodeId: string | null;
  anchorX: number | null;
  anchorY: number | null;
  body: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface CreateCommentPayload {
  pageId: string;
  nodeId?: string;
  anchorX?: number;
  anchorY?: number;
  body: string;
}

/** All comments (roots + replies) for a page. The site is resolved server-side
 * from the `X-Site-Id` header, so the path stays flat. */
export const listCommentsRequest = (pageId: string): Promise<CommentRow[]> =>
  request<CommentRow[]>({ url: "/comments", method: "GET", params: { pageId } });

export const createCommentRequest = (payload: CreateCommentPayload): Promise<CommentRow> =>
  request<CommentRow>({ url: "/comments", method: "POST", data: payload });

export const replyCommentRequest = (rootId: string, body: string): Promise<CommentRow> =>
  request<CommentRow>({ url: `/comments/${rootId}/replies`, method: "POST", data: { body } });

export const resolveCommentRequest = (
  rootId: string,
  resolved: boolean,
): Promise<{ ok: true }> =>
  request<{ ok: true }>({
    url: `/comments/${rootId}/resolve`,
    method: "PATCH",
    data: { resolved },
  });

export const deleteCommentRequest = (id: string): Promise<{ ok: true }> =>
  request<{ ok: true }>({ url: `/comments/${id}`, method: "DELETE" });

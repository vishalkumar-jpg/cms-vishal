import { request } from "@/services/AxiosService";
import type {
  CreatePageFromTemplatePayload,
  CreatePagePayload,
  CreateTranslationPayload,
  ListPagesQuery,
  Page,
  PageSummary,
  PageVersion,
  PreviewLink,
  SaveDraftPayload,
  SchedulePayload,
  UpdatePagePayload,
} from "../types";

/**
 * Raw pages API calls. The API is site-scoped via the `X-Site-Id` header (added
 * by the Axios mutator from the active site), so the path is just `/pages` — the
 * controller resolves the tenant from the header, not the URL.
 */
const base = (_siteId: string): string => `/pages`;

export const listPagesRequest = (
  siteId: string,
  query?: ListPagesQuery,
): Promise<PageSummary[]> =>
  request<PageSummary[]>({ url: base(siteId), method: "GET", params: query });

export const getPageRequest = (siteId: string, pageId: string): Promise<Page> =>
  request<Page>({ url: `${base(siteId)}/${pageId}`, method: "GET" });

export const createPageRequest = (
  siteId: string,
  payload: CreatePagePayload,
): Promise<Page> => request<Page>({ url: base(siteId), method: "POST", data: payload });

export const createPageFromTemplateRequest = (
  siteId: string,
  payload: CreatePageFromTemplatePayload,
): Promise<Page> =>
  request<Page>({ url: `${base(siteId)}/from-template`, method: "POST", data: payload });

export const updatePageRequest = (
  siteId: string,
  pageId: string,
  payload: UpdatePagePayload,
): Promise<Page> =>
  request<Page>({ url: `${base(siteId)}/${pageId}`, method: "PATCH", data: payload });

export const saveDraftRequest = (
  siteId: string,
  pageId: string,
  payload: SaveDraftPayload,
): Promise<Page> =>
  request<Page>({ url: `${base(siteId)}/${pageId}/draft`, method: "PATCH", data: payload });

export const publishPageRequest = (siteId: string, pageId: string): Promise<Page> =>
  request<Page>({ url: `${base(siteId)}/${pageId}/publish`, method: "POST" });

// -- B14 editorial workflow -------------------------------------------------
export const submitPageReviewRequest = (
  siteId: string,
  pageId: string,
  reviewerId?: string,
): Promise<Page> =>
  request<Page>({
    url: `${base(siteId)}/${pageId}/submit-review`,
    method: "POST",
    data: reviewerId ? { reviewerId } : {},
  });

export const approvePageRequest = (
  siteId: string,
  pageId: string,
  note?: string,
): Promise<Page> =>
  request<Page>({
    url: `${base(siteId)}/${pageId}/approve`,
    method: "POST",
    data: note ? { note } : {},
  });

export const rejectPageRequest = (
  siteId: string,
  pageId: string,
  note: string,
): Promise<Page> =>
  request<Page>({ url: `${base(siteId)}/${pageId}/reject`, method: "POST", data: { note } });

export const duplicatePageRequest = (siteId: string, pageId: string): Promise<Page> =>
  request<Page>({ url: `${base(siteId)}/${pageId}/duplicate`, method: "POST" });

// -- i18n / localization (B13) ------------------------------------------------
export const listPageTranslationsRequest = (
  siteId: string,
  pageId: string,
): Promise<PageSummary[]> =>
  request<PageSummary[]>({ url: `${base(siteId)}/${pageId}/translations`, method: "GET" });

export const createPageTranslationRequest = (
  siteId: string,
  pageId: string,
  payload: CreateTranslationPayload,
): Promise<Page> =>
  request<Page>({
    url: `${base(siteId)}/${pageId}/translations`,
    method: "POST",
    data: payload,
  });

export const deletePageRequest = (siteId: string, pageId: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `${base(siteId)}/${pageId}`, method: "DELETE" });

export const schedulePageRequest = (
  siteId: string,
  pageId: string,
  payload: SchedulePayload,
): Promise<Page> =>
  request<Page>({ url: `${base(siteId)}/${pageId}/schedule`, method: "POST", data: payload });

/** CONTENT-OPS: mint a shareable no-login draft preview link. */
export const createPagePreviewLinkRequest = (
  siteId: string,
  pageId: string,
): Promise<PreviewLink> =>
  request<PreviewLink>({ url: `${base(siteId)}/${pageId}/preview-link`, method: "POST" });

/** CONTENT-OPS: revoke all preview links for a page. */
export const revokePagePreviewLinkRequest = (
  siteId: string,
  pageId: string,
): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `${base(siteId)}/${pageId}/preview-link`, method: "DELETE" });

export const listPageVersionsRequest = (
  siteId: string,
  pageId: string,
): Promise<PageVersion[]> =>
  request<PageVersion[]>({ url: `${base(siteId)}/${pageId}/versions`, method: "GET" });

export const rollbackPageRequest = (
  siteId: string,
  pageId: string,
  versionId: string,
): Promise<Page> =>
  request<Page>({ url: `${base(siteId)}/${pageId}/rollback/${versionId}`, method: "POST" });

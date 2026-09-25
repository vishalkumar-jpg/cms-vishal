import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import {
  approvePageRequest,
  createPageFromTemplateRequest,
  createPageRequest,
  createPageTranslationRequest,
  deletePageRequest,
  duplicatePageRequest,
  getPageRequest,
  listPageTranslationsRequest,
  listPageVersionsRequest,
  listPagesRequest,
  publishPageRequest,
  rejectPageRequest,
  rollbackPageRequest,
  saveDraftRequest,
  schedulePageRequest,
  submitPageReviewRequest,
  updatePageRequest,
} from "../api/pages.api";
import type {
  CreatePageFromTemplatePayload,
  CreatePagePayload,
  CreateTranslationPayload,
  ListPagesQuery,
  Page,
  PageSummary,
  PageVersion,
  SaveDraftPayload,
  SchedulePayload,
  UpdatePagePayload,
} from "../types";

/** Wrapped page hooks. All page server access goes through these. */

export const usePages = (siteId: string | null, query?: ListPagesQuery) =>
  useQuery<PageSummary[]>({
    queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId, query ?? {}],
    queryFn: () => listPagesRequest(siteId as string, query),
    enabled: !!siteId,
  });

export const usePage = (siteId: string | null, pageId: string | null) =>
  useQuery<Page>({
    queryKey: [ADMIN_QUERY_KEYS.PAGE, siteId, pageId],
    queryFn: () => getPageRequest(siteId as string, pageId as string),
    enabled: !!siteId && !!pageId,
    staleTime: 60_000,
  });

export const useCreatePage = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePagePayload) => createPageRequest(siteId as string, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] }),
  });
};

/** Create a draft page by copying a published template skeleton layout. */
export const useCreatePageFromTemplate = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePageFromTemplatePayload) =>
      createPageFromTemplateRequest(siteId as string, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] }),
  });
};

export const useUpdatePage = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, payload }: { pageId: string; payload: UpdatePagePayload }) =>
      updatePageRequest(siteId as string, pageId, payload),
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] });
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE, siteId, page.id] });
    },
  });
};

/** Debounced autosave target. Returns the updated page. */
export const useSavePageDraft = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, payload }: { pageId: string; payload: SaveDraftPayload }) =>
      saveDraftRequest(siteId as string, pageId, payload),
    onSuccess: (saved) => {
      // Merge metadata only — keep the in-editor Craft tree as source of truth and
      // avoid replacing `draftLayout` (which would re-trigger builder hydration).
      qc.setQueryData<Page>([ADMIN_QUERY_KEYS.PAGE, siteId, saved.id], (prev) =>
        prev
          ? {
              ...prev,
              updatedAt: saved.updatedAt,
              status: saved.status,
              title: saved.title,
              workflowState: saved.workflowState,
            }
          : saved,
      );
    },
  });
};

export const usePublishPage = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) => publishPageRequest(siteId as string, pageId),
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] });
      qc.setQueryData([ADMIN_QUERY_KEYS.PAGE, siteId, page.id], page);
    },
  });
};

/** B14: submit a draft page for review (optionally assigning a reviewer). */
export const useSubmitPageReview = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, reviewerId }: { pageId: string; reviewerId?: string }) =>
      submitPageReviewRequest(siteId as string, pageId, reviewerId),
    onSuccess: (page) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] });
      qc.setQueryData([ADMIN_QUERY_KEYS.PAGE, siteId, page.id], page);
    },
  });
};

/** B14: approve a page in review (in_review → approved). Editor+ only. */
export const useApprovePage = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, note }: { pageId: string; note?: string }) =>
      approvePageRequest(siteId as string, pageId, note),
    onSuccess: (page) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] });
      qc.setQueryData([ADMIN_QUERY_KEYS.PAGE, siteId, page.id], page);
    },
  });
};

/** B14: reject a page back to draft with a note (in_review → draft). Editor+ only. */
export const useRejectPage = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, note }: { pageId: string; note: string }) =>
      rejectPageRequest(siteId as string, pageId, note),
    onSuccess: (page) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] });
      qc.setQueryData([ADMIN_QUERY_KEYS.PAGE, siteId, page.id], page);
    },
  });
};

// -- i18n / localization (B13) ------------------------------------------------

/** The sibling-locale translations of a page (one row per locale, incl. itself). */
export const usePageTranslations = (siteId: string | null, pageId: string | null) =>
  useQuery<PageSummary[]>({
    queryKey: [ADMIN_QUERY_KEYS.PAGE_TRANSLATIONS, siteId, pageId],
    queryFn: () => listPageTranslationsRequest(siteId as string, pageId as string),
    enabled: !!siteId && !!pageId,
  });

/** Create a translation of a page; returns the new (draft) translation row. */
export const useCreatePageTranslation = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation<Page, unknown, { pageId: string; payload: CreateTranslationPayload }>({
    mutationFn: ({ pageId, payload }) =>
      createPageTranslationRequest(siteId as string, pageId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] }),
  });
};

export const useDuplicatePage = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) => duplicatePageRequest(siteId as string, pageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] }),
  });
};

export const useDeletePage = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) => deletePageRequest(siteId as string, pageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] }),
  });
};

export const useSchedulePage = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, payload }: { pageId: string; payload: SchedulePayload }) =>
      schedulePageRequest(siteId as string, pageId, payload),
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] });
      qc.setQueryData([ADMIN_QUERY_KEYS.PAGE, siteId, page.id], page);
    },
  });
};

export const usePageVersions = (siteId: string | null, pageId: string | null) =>
  useQuery<PageVersion[]>({
    queryKey: [ADMIN_QUERY_KEYS.PAGE_VERSIONS, siteId, pageId],
    queryFn: () => listPageVersionsRequest(siteId as string, pageId as string),
    enabled: !!siteId && !!pageId,
  });

export const useRollbackPage = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, versionId }: { pageId: string; versionId: string }) =>
      rollbackPageRequest(siteId as string, pageId, versionId),
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE, siteId, page.id] });
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGE_VERSIONS, siteId, page.id] });
    },
  });
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "page";

/**
 * Set a page as the site's home page. Home is the `slug === "home"` convention
 * the public renderer maps to `/`. We first free the current home page (if any)
 * by renaming its slug to a title-derived slug, then set the target's slug to
 * `home`. Both writes go through PATCH /pages/:id (UpdatePageDto.slug).
 *
 * NOTE: this is a UI-level convention. A real `site.homePageId` field would be
 * cleaner (no slug juggling, no published-slug churn) — see WAVE-CMS-COMPLETE.md.
 */
export const useSetHomePage = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pageId,
      currentHome,
    }: {
      pageId: string;
      /** The page that currently has slug "home", if any. */
      currentHome?: { id: string; title: string } | null;
    }) => {
      if (currentHome && currentHome.id !== pageId) {
        await updatePageRequest(siteId as string, currentHome.id, {
          slug: slugify(currentHome.title),
        });
      }
      return updatePageRequest(siteId as string, pageId, { slug: "home" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] }),
  });
};

/** Update a page's slug (with live URL preview/validation done in the dialog). */
export const useUpdatePageSlug = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, slug }: { pageId: string; slug: string }) =>
      updatePageRequest(siteId as string, pageId, { slug }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] }),
  });
};

/** Reparent a page (tree hierarchy). */
export const useSetPageParent = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, parentId }: { pageId: string; parentId: string | null }) =>
      updatePageRequest(siteId as string, pageId, { parentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PAGES, siteId] }),
  });
};

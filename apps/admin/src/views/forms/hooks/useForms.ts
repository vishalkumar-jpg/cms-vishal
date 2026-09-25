import { API_PREFIX } from "@ob-cms/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  createFormRequest,
  deleteFormRequest,
  getAnalyticsRequest,
  getCrmConfigRequest,
  getFormRequest,
  listFormsRequest,
  listSubmissionsRequest,
  publishFormRequest,
  setCrmConfigRequest,
  triageSubmissionRequest,
  updateFormRequest,
} from "../api/forms.api";
import type {
  CreateFormPayload,
  CrmConfig,
  CrmConfigPayload,
  Form,
  FormAnalytics,
  FormSubmission,
  SubmissionFilters,
  SubmissionsPage,
  TriagePayload,
  UpdateFormPayload,
} from "../types";

export const useForms = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Form[]>({
    queryKey: [ADMIN_QUERY_KEYS.FORMS, siteId],
    queryFn: () => listFormsRequest(),
    enabled: !!siteId,
  });
};

export const useForm = (id: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Form>({
    queryKey: [ADMIN_QUERY_KEYS.FORM, siteId, id],
    queryFn: () => getFormRequest(id as string),
    enabled: !!siteId && !!id,
  });
};

export const useCreateForm = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Form, unknown, CreateFormPayload>({
    mutationFn: (payload) => createFormRequest(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.FORMS, siteId] }),
  });
};

export const useUpdateForm = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Form, unknown, { id: string; payload: UpdateFormPayload }>({
    mutationFn: ({ id, payload }) => updateFormRequest(id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.FORMS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.FORM, siteId, id] });
    },
  });
};

export const usePublishForm = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Form, unknown, string>({
    mutationFn: (id) => publishFormRequest(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.FORMS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.FORM, siteId, id] });
    },
  });
};

export const useDeleteForm = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: true }, unknown, string>({
    mutationFn: (id) => deleteFormRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.FORMS, siteId] }),
  });
};

export const useSubmissions = (
  id: string | null,
  page: number,
  pageSize: number,
  filters: SubmissionFilters,
) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<SubmissionsPage>({
    // Keyed on [FORM_SUBMISSIONS, siteId, formId, filters+page] so any filter
    // change refetches without colliding with other forms/sites.
    queryKey: [ADMIN_QUERY_KEYS.FORM_SUBMISSIONS, siteId, id, { page, pageSize, ...filters }],
    queryFn: () => listSubmissionsRequest(id as string, page, pageSize, filters),
    enabled: !!siteId && !!id,
  });
};

/** Mark a submission spam/not-spam and/or read/unread; refreshes the inbox. */
export const useTriageSubmission = (formId: string | null) => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<FormSubmission, unknown, { submissionId: string; payload: TriagePayload }>({
    mutationFn: ({ submissionId, payload }) => triageSubmissionRequest(submissionId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: [ADMIN_QUERY_KEYS.FORM_SUBMISSIONS, siteId, formId],
      });
    },
  });
};

export const useFormAnalytics = (id: string | null, days = 30) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<FormAnalytics>({
    // Keyed off FORM with an "analytics" discriminator (no global queryKeys edit).
    queryKey: [ADMIN_QUERY_KEYS.FORM, siteId, id, "analytics", days],
    queryFn: () => getAnalyticsRequest(id as string, days),
    enabled: !!siteId && !!id,
  });
};

export const useCrmConfig = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<CrmConfig>({
    queryKey: [ADMIN_QUERY_KEYS.CRM_CONFIG, siteId],
    queryFn: () => getCrmConfigRequest(),
    enabled: !!siteId,
  });
};

export const useSetCrmConfig = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: true }, unknown, CrmConfigPayload>({
    mutationFn: (payload) => setCrmConfigRequest(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.CRM_CONFIG, siteId] }),
  });
};

/** Absolute URL to the CSV submissions export (opened in a new tab; auth via cookies). */
export const submissionsExportUrl = (formId: string): string =>
  `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}${API_PREFIX}/forms/${formId}/submissions/export`;

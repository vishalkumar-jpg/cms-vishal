import { request } from "@/services/AxiosService";
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

/**
 * Raw forms API calls. Site-scoped via the X-Site-Id header (Axios mutator),
 * so paths are relative: `/forms`, never `/sites/:id/forms`. CRM config is a
 * site-level singleton (not per form).
 */
export const listFormsRequest = (): Promise<Form[]> =>
  request<Form[]>({ url: `/forms`, method: "GET" });

export const getFormRequest = (id: string): Promise<Form> =>
  request<Form>({ url: `/forms/${id}`, method: "GET" });

export const createFormRequest = (payload: CreateFormPayload): Promise<Form> =>
  request<Form>({ url: `/forms`, method: "POST", data: payload });

export const updateFormRequest = (id: string, payload: UpdateFormPayload): Promise<Form> =>
  request<Form>({ url: `/forms/${id}`, method: "PATCH", data: payload });

export const publishFormRequest = (id: string): Promise<Form> =>
  request<Form>({ url: `/forms/${id}/publish`, method: "POST" });

export const deleteFormRequest = (id: string): Promise<{ ok: true }> =>
  request<{ ok: true }>({ url: `/forms/${id}`, method: "DELETE" });

export const listSubmissionsRequest = (
  id: string,
  page: number,
  pageSize: number,
  filters: SubmissionFilters,
): Promise<SubmissionsPage> =>
  request<SubmissionsPage>({
    url: `/forms/${id}/submissions`,
    method: "GET",
    params: {
      page,
      pageSize,
      spam: filters.spam,
      read: filters.read,
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.q ? { q: filters.q } : {}),
    },
  });

export const triageSubmissionRequest = (
  submissionId: string,
  payload: TriagePayload,
): Promise<FormSubmission> =>
  request<FormSubmission>({
    url: `/forms/submissions/${submissionId}/triage`,
    method: "PATCH",
    data: payload,
  });

export const getAnalyticsRequest = (id: string, days = 30): Promise<FormAnalytics> =>
  request<FormAnalytics>({
    url: `/forms/${id}/analytics`,
    method: "GET",
    params: { days },
  });

export const getCrmConfigRequest = (): Promise<CrmConfig> =>
  request<CrmConfig>({ url: `/forms/crm-config`, method: "GET" });

export const setCrmConfigRequest = (payload: CrmConfigPayload): Promise<{ ok: true }> =>
  request<{ ok: true }>({ url: `/forms/crm-config`, method: "PUT", data: payload });

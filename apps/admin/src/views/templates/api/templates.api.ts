import { request } from "@/services/AxiosService";
import type {
  CreateTemplatePayload,
  ListTemplatesQuery,
  Template,
  UpdateTemplatePayload,
} from "../types";

/** Raw templates API calls (assumed Wave 2b endpoints). */
const base = (_siteId: string): string => `/templates`;

export const listTemplatesRequest = (
  siteId: string,
  query?: ListTemplatesQuery,
): Promise<Template[]> =>
  request<Template[]>({
    url: base(siteId),
    method: "GET",
    params: query?.kind ? { kind: query.kind } : undefined,
  });

export const createTemplateRequest = (
  siteId: string,
  payload: CreateTemplatePayload,
): Promise<Template> => request<Template>({ url: base(siteId), method: "POST", data: payload });

export const updateTemplateRequest = (
  siteId: string,
  templateId: string,
  payload: UpdateTemplatePayload,
): Promise<Template> =>
  request<Template>({ url: `${base(siteId)}/${templateId}`, method: "PATCH", data: payload });

export const deleteTemplateRequest = (
  siteId: string,
  templateId: string,
): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `${base(siteId)}/${templateId}`, method: "DELETE" });

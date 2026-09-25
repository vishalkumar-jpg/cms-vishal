import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import {
  createTemplateRequest,
  deleteTemplateRequest,
  listTemplatesRequest,
  updateTemplateRequest,
} from "../api/templates.api";
import type {
  CreateTemplatePayload,
  ListTemplatesQuery,
  Template,
  UpdateTemplatePayload,
} from "../types";

export const useTemplates = (siteId: string | null, query?: ListTemplatesQuery) =>
  useQuery<Template[]>({
    queryKey: [ADMIN_QUERY_KEYS.TEMPLATES, siteId, query ?? {}],
    queryFn: () => listTemplatesRequest(siteId as string, query),
    enabled: !!siteId,
  });

export const useCreateTemplate = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTemplatePayload) =>
      createTemplateRequest(siteId as string, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.TEMPLATES, siteId] }),
  });
};

export const useDeleteTemplate = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => deleteTemplateRequest(siteId as string, templateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.TEMPLATES, siteId] }),
  });
};

export const useUpdateTemplate = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: string; payload: UpdateTemplatePayload }) =>
      updateTemplateRequest(siteId as string, templateId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.TEMPLATES, siteId] }),
  });
};

export type { Template, CreateTemplatePayload, UpdateTemplatePayload };

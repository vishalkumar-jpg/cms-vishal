import { request } from "@/services/AxiosService";
import type { ApiRuleGroup } from "../rule-adapter";

/** Audiences API (Phase 3). Header-scoped to the active site (X-Site-Id). */

export interface Audience {
  id: string;
  name: string;
  description: string | null;
  rules: ApiRuleGroup;
  members: number;
}

export interface AudienceInput {
  name: string;
  description?: string;
  rules: ApiRuleGroup;
}

export const listAudiencesRequest = (): Promise<Audience[]> =>
  request<Audience[]>({ url: "/audiences", method: "GET" });

export const createAudienceRequest = (data: AudienceInput): Promise<Audience> =>
  request<Audience>({ url: "/audiences", method: "POST", data });

export const updateAudienceRequest = (id: string, data: AudienceInput): Promise<Audience> =>
  request<Audience>({ url: `/audiences/${id}`, method: "PUT", data });

export const deleteAudienceRequest = (id: string): Promise<{ id: string }> =>
  request<{ id: string }>({ url: `/audiences/${id}`, method: "DELETE" });

export const previewAudienceRequest = (
  rules: ApiRuleGroup,
): Promise<{ count: number; total: number }> =>
  request<{ count: number; total: number }>({
    url: "/audiences/preview",
    method: "POST",
    data: { rules },
  });

export const recomputeAudienceRequest = (id: string): Promise<{ enqueued: boolean }> =>
  request<{ enqueued: boolean }>({ url: `/audiences/${id}/recompute`, method: "POST" });

export interface AudienceMember {
  visitorId: string;
  visitorProfileId: string;
  email: string | null;
  companyName: string | null;
  score: number;
  lastSeen: string | null;
}

export const listMembersRequest = (id: string): Promise<AudienceMember[]> =>
  request<AudienceMember[]>({ url: `/audiences/${id}/members`, method: "GET" });

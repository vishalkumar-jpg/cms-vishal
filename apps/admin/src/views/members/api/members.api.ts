import type { Role } from "@ob-cms/shared";
import { request } from "@/services/AxiosService";

/**
 * Site-members API. Unlike most admin calls, the members controller is mounted
 * under `/sites/:siteId/members` (path-scoped, not header-scoped), so the active
 * site id is embedded in the URL here.
 */

/** A member row joined with its user, as returned by GET .../members. */
export interface SiteMemberView {
  id: string;
  siteId: string;
  userId: string;
  role: Role;
  /** RBAC-2: assigned custom role id (null → on the built-in role's default). */
  customRoleId?: string | null;
  /** RBAC-2: effective permissions (custom role's set, else built-in default). */
  permissions?: string[];
  user?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  createdAt?: string;
}

export interface AddMemberPayload {
  userId: string;
  role: Role;
}

export const listMembersRequest = (siteId: string): Promise<SiteMemberView[]> =>
  request<SiteMemberView[]>({ url: `/sites/${siteId}/members`, method: "GET" });

export const addMemberRequest = (
  siteId: string,
  payload: AddMemberPayload,
): Promise<SiteMemberView> =>
  request<SiteMemberView>({ url: `/sites/${siteId}/members`, method: "POST", data: payload });

export const updateMemberRoleRequest = (
  siteId: string,
  userId: string,
  role: Role,
): Promise<SiteMemberView> =>
  request<SiteMemberView>({
    url: `/sites/${siteId}/members/${userId}`,
    method: "PATCH",
    data: { role },
  });

export const removeMemberRequest = (
  siteId: string,
  userId: string,
): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `/sites/${siteId}/members/${userId}`, method: "DELETE" });

import type { Role } from "@ob-cms/shared";
import { request } from "@/services/AxiosService";

/**
 * RBAC-2 custom-roles API. Mounted under `/sites/:siteId/roles` (path-scoped,
 * like members), so the active site id is embedded in the URL.
 */

export interface PermissionGroup {
  domain: string;
  label: string;
  permissions: string[];
}

export interface BuiltinRoleView {
  role: Role;
  isBuiltin: true;
  permissions: string[];
}

export interface CustomRole {
  id: string;
  siteId: string;
  name: string;
  description?: string | null;
  permissions: string[];
  isBuiltin: boolean;
  createdAt?: string;
}

export interface RolesList {
  builtin: BuiltinRoleView[];
  custom: CustomRole[];
}

export interface CreateCustomRolePayload {
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateCustomRolePayload {
  name?: string;
  description?: string;
  permissions?: string[];
}

export const getPermissionCatalogRequest = (siteId: string): Promise<PermissionGroup[]> =>
  request<PermissionGroup[]>({ url: `/sites/${siteId}/roles/permissions`, method: "GET" });

export const listRolesRequest = (siteId: string): Promise<RolesList> =>
  request<RolesList>({ url: `/sites/${siteId}/roles`, method: "GET" });

export const createCustomRoleRequest = (
  siteId: string,
  payload: CreateCustomRolePayload,
): Promise<CustomRole> =>
  request<CustomRole>({ url: `/sites/${siteId}/roles`, method: "POST", data: payload });

export const updateCustomRoleRequest = (
  siteId: string,
  roleId: string,
  payload: UpdateCustomRolePayload,
): Promise<CustomRole> =>
  request<CustomRole>({ url: `/sites/${siteId}/roles/${roleId}`, method: "PUT", data: payload });

export const deleteCustomRoleRequest = (
  siteId: string,
  roleId: string,
): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `/sites/${siteId}/roles/${roleId}`, method: "DELETE" });

export const assignCustomRoleRequest = (
  siteId: string,
  userId: string,
  customRoleId: string | null,
): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({
    url: `/sites/${siteId}/roles/members/${userId}`,
    method: "PATCH",
    data: { customRoleId },
  });

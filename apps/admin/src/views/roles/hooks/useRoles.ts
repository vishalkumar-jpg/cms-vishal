import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@ob-cms/shared";
import { useSiteStore } from "@/store/siteStore";
import {
  assignCustomRoleRequest,
  createCustomRoleRequest,
  deleteCustomRoleRequest,
  getPermissionCatalogRequest,
  listRolesRequest,
  updateCustomRoleRequest,
  type CreateCustomRolePayload,
  type PermissionGroup,
  type RolesList,
  type UpdateCustomRolePayload,
} from "../api/roles.api";

const rolesKey = (siteId: string | null) => [QUERY_KEYS.CUSTOM_ROLES, siteId];
const catalogKey = (siteId: string | null) => [QUERY_KEYS.PERMISSION_CATALOG, siteId];

export const usePermissionCatalog = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<PermissionGroup[]>({
    queryKey: catalogKey(siteId),
    queryFn: () => getPermissionCatalogRequest(siteId as string),
    enabled: !!siteId,
    staleTime: Infinity,
  });
};

export const useRoles = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<RolesList>({
    queryKey: rolesKey(siteId),
    queryFn: () => listRolesRequest(siteId as string),
    enabled: !!siteId,
  });
};

export const useCreateCustomRole = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation({
    mutationFn: (payload: CreateCustomRolePayload) =>
      createCustomRoleRequest(siteId as string, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: rolesKey(siteId) }),
  });
};

export const useUpdateCustomRole = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: string; payload: UpdateCustomRolePayload }) =>
      updateCustomRoleRequest(siteId as string, roleId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: rolesKey(siteId) }),
  });
};

export const useDeleteCustomRole = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation({
    mutationFn: (roleId: string) => deleteCustomRoleRequest(siteId as string, roleId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rolesKey(siteId) });
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.SITE_MEMBERS, siteId] });
    },
  });
};

export const useAssignCustomRole = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation({
    mutationFn: ({ userId, customRoleId }: { userId: string; customRoleId: string | null }) =>
      assignCustomRoleRequest(siteId as string, userId, customRoleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEYS.SITE_MEMBERS, siteId] }),
  });
};

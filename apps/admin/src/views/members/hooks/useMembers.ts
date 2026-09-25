import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, type Role } from "@ob-cms/shared";
import { useSiteStore } from "@/store/siteStore";
import {
  addMemberRequest,
  listMembersRequest,
  removeMemberRequest,
  updateMemberRoleRequest,
  type AddMemberPayload,
  type SiteMemberView,
} from "../api/members.api";

const membersKey = (siteId: string | null) => [QUERY_KEYS.SITE_MEMBERS, siteId];

export const useMembers = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<SiteMemberView[]>({
    queryKey: membersKey(siteId),
    queryFn: () => listMembersRequest(siteId as string),
    enabled: !!siteId,
  });
};

export const useAddMember = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation({
    mutationFn: (payload: AddMemberPayload) => addMemberRequest(siteId as string, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(siteId) }),
  });
};

export const useUpdateMemberRole = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      updateMemberRoleRequest(siteId as string, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(siteId) }),
  });
};

export const useRemoveMember = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation({
    mutationFn: (userId: string) => removeMemberRequest(siteId as string, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(siteId) }),
  });
};

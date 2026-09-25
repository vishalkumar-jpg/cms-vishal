import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  createInvitationRequest,
  listInvitationsRequest,
  resendInvitationRequest,
  revokeInvitationRequest,
  type CreateInvitationPayload,
  type Invitation,
} from "../api/invitations.api";

/** Wrapped invitation hooks. All invitation server access goes through these. */

const invitesKey = (siteId: string | null) => [ADMIN_QUERY_KEYS.INVITATIONS, siteId];

export const useInvitations = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Invitation[]>({
    queryKey: invitesKey(siteId),
    queryFn: () => listInvitationsRequest(),
    enabled: !!siteId,
  });
};

export const useCreateInvitation = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Invitation, unknown, CreateInvitationPayload>({
    mutationFn: (payload) => createInvitationRequest(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitesKey(siteId) }),
  });
};

export const useResendInvitation = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Invitation, unknown, string>({
    mutationFn: (id) => resendInvitationRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitesKey(siteId) }),
  });
};

export const useRevokeInvitation = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: boolean }, unknown, string>({
    mutationFn: (id) => revokeInvitationRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitesKey(siteId) }),
  });
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { toast } from "@/components/ui";
import {
  createAudienceRequest,
  deleteAudienceRequest,
  listAudiencesRequest,
  listMembersRequest,
  recomputeAudienceRequest,
  updateAudienceRequest,
  type Audience,
  type AudienceInput,
  type AudienceMember,
} from "../api/audiences.api";

export const useAudiences = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Audience[]>({
    queryKey: [ADMIN_QUERY_KEYS.AUDIENCES, siteId],
    queryFn: () => listAudiencesRequest(),
    enabled: !!siteId,
  });
};

export const useAudienceMembers = (id: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<AudienceMember[]>({
    queryKey: [ADMIN_QUERY_KEYS.AUDIENCE_MEMBERS, siteId, id],
    queryFn: () => listMembersRequest(id as string),
    enabled: !!siteId && !!id,
  });
};

export const useAudienceMutations = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.AUDIENCES, siteId] });

  const create = useMutation({
    mutationFn: (data: AudienceInput) => createAudienceRequest(data),
    onSuccess: () => {
      invalidate();
      toast.success("Audience created");
    },
    onError: () => toast.error("Could not create audience"),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AudienceInput }) => updateAudienceRequest(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Audience updated");
    },
    onError: () => toast.error("Could not update audience"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAudienceRequest(id),
    onSuccess: () => {
      invalidate();
      toast.success("Audience deleted");
    },
    onError: () => toast.error("Could not delete audience"),
  });

  const recompute = useMutation({
    mutationFn: (id: string) => recomputeAudienceRequest(id),
    onSuccess: () => {
      toast.success("Recompute queued — members refresh shortly");
      setTimeout(invalidate, 1500);
    },
    onError: () => toast.error("Could not queue recompute"),
  });

  return { create, update, remove, recompute };
};

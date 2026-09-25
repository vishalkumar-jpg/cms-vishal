import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateReusableBlockCache } from "@ob-cms/blocks";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import {
  createReusableBlockRequest,
  deleteReusableBlockRequest,
  getReusableBlockRequest,
  listReusableBlocksRequest,
  updateReusableBlockRequest,
} from "../api/reusableBlocks.api";
import type {
  CreateReusableBlockPayload,
  ReusableBlock,
  UpdateReusableBlockPayload,
} from "../types";

/** List the active site's reusable blocks. */
export const useReusableBlocks = (siteId: string | null) =>
  useQuery<ReusableBlock[]>({
    queryKey: [ADMIN_QUERY_KEYS.REUSABLE_BLOCKS, siteId],
    queryFn: listReusableBlocksRequest,
    enabled: !!siteId,
  });

/** Read one reusable block (with its layout). */
export const useReusableBlock = (siteId: string | null, id: string | null) =>
  useQuery<ReusableBlock>({
    queryKey: [ADMIN_QUERY_KEYS.REUSABLE_BLOCK, siteId, id],
    queryFn: () => getReusableBlockRequest(id as string),
    enabled: !!siteId && !!id,
    retry: (count, error) => {
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status === 404) return false;
      return count < 2;
    },
  });

export const useCreateReusableBlock = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReusableBlockPayload) => createReusableBlockRequest(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.REUSABLE_BLOCKS, siteId] }),
  });
};

export const useUpdateReusableBlock = (siteId: string | null, id: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateReusableBlockPayload) =>
      updateReusableBlockRequest(id as string, payload),
    onSuccess: (block) => {
      invalidateReusableBlockCache(block.id);
      qc.setQueryData([ADMIN_QUERY_KEYS.REUSABLE_BLOCK, siteId, id], block);
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.REUSABLE_BLOCKS, siteId] });
    },
  });
};

export const useDeleteReusableBlock = (siteId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReusableBlockRequest(id),
    onSuccess: (_data, id) => {
      invalidateReusableBlockCache(id);
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.REUSABLE_BLOCKS, siteId] });
    },
  });
};

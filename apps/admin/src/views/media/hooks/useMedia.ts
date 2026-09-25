import { API_PREFIX } from "@ob-cms/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Axios from "axios";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  confirmMediaRequest,
  createFolderRequest,
  cropMediaRequest,
  deleteFolderRequest,
  deleteMediaRequest,
  getMediaRequest,
  listFoldersRequest,
  listMediaRequest,
  mediaUsageRequest,
  moveMediaRequest,
  presignMediaRequest,
  updateFolderRequest,
  updateMediaRequest,
} from "../api/media.api";
import type {
  CreateFolderPayload,
  CropRect,
  ListMediaQuery,
  MediaFolder,
  MediaItem,
  MediaUsageRef,
  MoveMediaPayload,
  UpdateFolderPayload,
  UpdateMediaPayload,
} from "../types";

export const useMediaList = (query?: ListMediaQuery) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<MediaItem[]>({
    queryKey: [ADMIN_QUERY_KEYS.MEDIA, siteId, query ?? {}],
    queryFn: () => listMediaRequest(query),
    enabled: !!siteId,
  });
};

export const useMediaItem = (id: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<MediaItem>({
    queryKey: [ADMIN_QUERY_KEYS.MEDIA_ITEM, siteId, id],
    queryFn: () => getMediaRequest(id as string),
    enabled: !!siteId && !!id,
  });
};

/** Read intrinsic dimensions of an image file (best-effort). */
const readImageSize = (file: File): Promise<{ width?: number; height?: number }> =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve({});
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

/**
 * Full upload flow: presign → direct PUT to S3/MinIO → confirm.
 * The PUT goes through a *bare* axios instance (no baseURL/credentials/envelope)
 * so the presigned URL signature stays intact.
 */
export const useUploadMedia = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<MediaItem, unknown, File>({
    mutationFn: async (file: File) => {
      const { media, uploadUrl } = await presignMediaRequest({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      await Axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      const { width, height } = await readImageSize(file);
      return confirmMediaRequest({ mediaId: media.id, size: file.size, width, height });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.MEDIA, siteId] }),
  });
};

export const useUpdateMedia = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMediaPayload }) =>
      updateMediaRequest(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.MEDIA, siteId] }),
  });
};

export const useDeleteMedia = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation({
    mutationFn: (id: string) => deleteMediaRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.MEDIA, siteId] }),
  });
};

/** Crop an image server-side, then refresh the item + its list. */
export const useCropMedia = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<MediaItem, unknown, { id: string; rect: CropRect }>({
    mutationFn: ({ id, rect }) => cropMediaRequest(id, rect),
    onSuccess: (item) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.MEDIA, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.MEDIA_ITEM, siteId, item.id] });
    },
  });
};

/** Where-used: pages/posts/collections referencing the asset. */
export const useMediaUsage = (id: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<MediaUsageRef[]>({
    queryKey: [ADMIN_QUERY_KEYS.MEDIA_USAGE, siteId, id],
    queryFn: () => mediaUsageRequest(id as string),
    enabled: !!siteId && !!id,
  });
};

// --- folders ----------------------------------------------------------------

export const useMediaFolders = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<MediaFolder[]>({
    queryKey: [ADMIN_QUERY_KEYS.MEDIA_FOLDERS, siteId],
    queryFn: () => listFoldersRequest(),
    enabled: !!siteId,
  });
};

export const useCreateFolder = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<MediaFolder, unknown, CreateFolderPayload>({
    mutationFn: (payload) => createFolderRequest(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.MEDIA_FOLDERS, siteId] }),
  });
};

export const useUpdateFolder = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<MediaFolder, unknown, { id: string; payload: UpdateFolderPayload }>({
    mutationFn: ({ id, payload }) => updateFolderRequest(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.MEDIA_FOLDERS, siteId] }),
  });
};

export const useDeleteFolder = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: boolean }, unknown, string>({
    mutationFn: (id) => deleteFolderRequest(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.MEDIA_FOLDERS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.MEDIA, siteId] });
    },
  });
};

export const useMoveMedia = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ moved: number }, unknown, MoveMediaPayload>({
    mutationFn: (payload) => moveMediaRequest(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.MEDIA, siteId] }),
  });
};

/** Absolute URL to the CSV export (opened in a new tab; auth via cookies). */
export const mediaExportUrl = (): string =>
  `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}${API_PREFIX}/media/export.csv`;

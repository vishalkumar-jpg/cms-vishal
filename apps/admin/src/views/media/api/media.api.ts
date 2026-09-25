import { request } from "@/services/AxiosService";
import type {
  ConfirmPayload,
  CreateFolderPayload,
  CropRect,
  ListMediaQuery,
  MediaFolder,
  MediaItem,
  MediaUsageRef,
  MoveMediaPayload,
  PresignPayload,
  PresignResult,
  UpdateFolderPayload,
  UpdateMediaPayload,
} from "../types";

/**
 * Raw media API calls. Site-scoped via the X-Site-Id header (Axios mutator),
 * so paths are relative: `/media`, never `/sites/:id/media`.
 */
export const listMediaRequest = (query?: ListMediaQuery): Promise<MediaItem[]> =>
  request<MediaItem[]>({ url: `/media`, method: "GET", params: query });

export const getMediaRequest = (id: string): Promise<MediaItem> =>
  request<MediaItem>({ url: `/media/${id}`, method: "GET" });

export const presignMediaRequest = (payload: PresignPayload): Promise<PresignResult> =>
  request<PresignResult>({ url: `/media/presign`, method: "POST", data: payload });

export const confirmMediaRequest = (payload: ConfirmPayload): Promise<MediaItem> =>
  request<MediaItem>({ url: `/media/confirm`, method: "POST", data: payload });

export const updateMediaRequest = (
  id: string,
  payload: UpdateMediaPayload,
): Promise<MediaItem> =>
  request<MediaItem>({ url: `/media/${id}`, method: "PATCH", data: payload });

export const deleteMediaRequest = (id: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `/media/${id}`, method: "DELETE" });

// --- crop / usage -----------------------------------------------------------

export const cropMediaRequest = (id: string, rect: CropRect): Promise<MediaItem> =>
  request<MediaItem>({ url: `/media/${id}/crop`, method: "POST", data: rect });

export const mediaUsageRequest = (id: string): Promise<MediaUsageRef[]> =>
  request<MediaUsageRef[]>({ url: `/media/${id}/usage`, method: "GET" });

// --- folders ----------------------------------------------------------------

export const listFoldersRequest = (): Promise<MediaFolder[]> =>
  request<MediaFolder[]>({ url: `/media/folders`, method: "GET" });

export const createFolderRequest = (payload: CreateFolderPayload): Promise<MediaFolder> =>
  request<MediaFolder>({ url: `/media/folders`, method: "POST", data: payload });

export const updateFolderRequest = (
  id: string,
  payload: UpdateFolderPayload,
): Promise<MediaFolder> =>
  request<MediaFolder>({ url: `/media/folders/${id}`, method: "PATCH", data: payload });

export const deleteFolderRequest = (id: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `/media/folders/${id}`, method: "DELETE" });

export const moveMediaRequest = (payload: MoveMediaPayload): Promise<{ moved: number }> =>
  request<{ moved: number }>({ url: `/media/move`, method: "POST", data: payload });

import { request } from "@/services/AxiosService";
import type {
  CreateReusableBlockPayload,
  ReusableBlock,
  UpdateReusableBlockPayload,
} from "../types";

/**
 * REUSE-BLOCKS API. Site-scoped via the `X-Site-Id` header (Axios mutator), so
 * paths are relative: `/reusable-blocks`. `GET` lists/reads; `POST` creates from
 * a serialized fragment; `PUT` updates (save = live; the API purges the render
 * cache so every instance re-resolves).
 */
export const listReusableBlocksRequest = (): Promise<ReusableBlock[]> =>
  request<ReusableBlock[]>({ url: "/reusable-blocks", method: "GET" });

export const getReusableBlockRequest = (id: string): Promise<ReusableBlock> =>
  request<ReusableBlock>({ url: `/reusable-blocks/${id}`, method: "GET" });

export const createReusableBlockRequest = (
  payload: CreateReusableBlockPayload,
): Promise<ReusableBlock> =>
  request<ReusableBlock>({ url: "/reusable-blocks", method: "POST", data: payload });

export const updateReusableBlockRequest = (
  id: string,
  payload: UpdateReusableBlockPayload,
): Promise<ReusableBlock> =>
  request<ReusableBlock>({ url: `/reusable-blocks/${id}`, method: "PUT", data: payload });

export const deleteReusableBlockRequest = (id: string): Promise<{ ok: true }> =>
  request<{ ok: true }>({ url: `/reusable-blocks/${id}`, method: "DELETE" });

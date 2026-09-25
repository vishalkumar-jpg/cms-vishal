import { request } from "@/services/AxiosService";
import type { SerializedLayout } from "@ob-cms/block-schema";
import type {
  Collection,
  CollectionItem,
  CreateCollectionPayload,
  CreateItemPayload,
  ItemsPage,
  ListItemsParams,
  UpdateCollectionPayload,
  UpdateItemPayload,
} from "../types";

/**
 * Raw collections API calls. Site-scoped via the X-Site-Id header (Axios
 * mutator), so paths are relative: `/collections`, never `/sites/:id/...`.
 */

// -- collections -------------------------------------------------------------

export const listCollectionsRequest = (): Promise<Collection[]> =>
  request<Collection[]>({ url: `/collections`, method: "GET" });

export const getCollectionRequest = (id: string): Promise<Collection> =>
  request<Collection>({ url: `/collections/${id}`, method: "GET" });

export const createCollectionRequest = (payload: CreateCollectionPayload): Promise<Collection> =>
  request<Collection>({ url: `/collections`, method: "POST", data: payload });

export const updateCollectionRequest = (
  id: string,
  payload: UpdateCollectionPayload,
): Promise<Collection> =>
  request<Collection>({ url: `/collections/${id}`, method: "PUT", data: payload });

/** Autosave the shared detail layout only (visual builder PATCH). */
export const patchCollectionDetailLayoutRequest = (
  id: string,
  detailLayout: SerializedLayout | null,
): Promise<Collection> =>
  request<Collection>({
    url: `/collections/${id}/detail-layout`,
    method: "PATCH",
    data: { detailLayout },
  });

export const deleteCollectionRequest = (id: string): Promise<{ ok: true }> =>
  request<{ ok: true }>({ url: `/collections/${id}`, method: "DELETE" });

// -- items -------------------------------------------------------------------

export const listItemsRequest = (
  collectionId: string,
  params: ListItemsParams,
): Promise<ItemsPage> =>
  request<ItemsPage>({ url: `/collections/${collectionId}/items`, method: "GET", params });

export const getItemRequest = (collectionId: string, itemId: string): Promise<CollectionItem> =>
  request<CollectionItem>({ url: `/collections/${collectionId}/items/${itemId}`, method: "GET" });

export const createItemRequest = (
  collectionId: string,
  payload: CreateItemPayload,
): Promise<CollectionItem> =>
  request<CollectionItem>({
    url: `/collections/${collectionId}/items`,
    method: "POST",
    data: payload,
  });

export const updateItemRequest = (
  collectionId: string,
  itemId: string,
  payload: UpdateItemPayload,
): Promise<CollectionItem> =>
  request<CollectionItem>({
    url: `/collections/${collectionId}/items/${itemId}`,
    method: "PUT",
    data: payload,
  });

export const publishItemRequest = (
  collectionId: string,
  itemId: string,
): Promise<CollectionItem> =>
  request<CollectionItem>({
    url: `/collections/${collectionId}/items/${itemId}/publish`,
    method: "POST",
  });

export const unpublishItemRequest = (
  collectionId: string,
  itemId: string,
): Promise<CollectionItem> =>
  request<CollectionItem>({
    url: `/collections/${collectionId}/items/${itemId}/unpublish`,
    method: "POST",
  });

export const deleteItemRequest = (
  collectionId: string,
  itemId: string,
): Promise<{ ok: true }> =>
  request<{ ok: true }>({
    url: `/collections/${collectionId}/items/${itemId}`,
    method: "DELETE",
  });

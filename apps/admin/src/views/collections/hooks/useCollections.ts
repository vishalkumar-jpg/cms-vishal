import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  createCollectionRequest,
  createItemRequest,
  deleteCollectionRequest,
  deleteItemRequest,
  getCollectionRequest,
  getItemRequest,
  listCollectionsRequest,
  listItemsRequest,
  patchCollectionDetailLayoutRequest,
  publishItemRequest,
  unpublishItemRequest,
  updateCollectionRequest,
  updateItemRequest,
} from "../api/collections.api";
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

// -- collections -------------------------------------------------------------

export const useCollections = (options?: { enabled?: boolean }) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const queryEnabled = options?.enabled !== false;
  return useQuery<Collection[]>({
    queryKey: [ADMIN_QUERY_KEYS.COLLECTIONS, siteId],
    queryFn: () => listCollectionsRequest(),
    enabled: !!siteId && queryEnabled,
  });
};

export const useCollection = (id: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Collection>({
    queryKey: [ADMIN_QUERY_KEYS.COLLECTION, siteId, id],
    queryFn: () => getCollectionRequest(id as string),
    enabled: !!siteId && !!id,
  });
};

export const useCreateCollection = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Collection, unknown, CreateCollectionPayload>({
    mutationFn: (payload) => createCollectionRequest(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.COLLECTIONS, siteId] }),
  });
};

export const useUpdateCollection = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Collection, unknown, { id: string; payload: UpdateCollectionPayload }>({
    mutationFn: ({ id, payload }) => updateCollectionRequest(id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.COLLECTIONS, siteId] });
      void qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.COLLECTION, siteId, id] });
    },
  });
};

/** Autosave the collection detail layout only — keeps name/slug/fields untouched. */
export const useSaveCollectionDetailLayout = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<
    Collection,
    unknown,
    { collectionId: string; detailLayout: SerializedLayout | null }
  >({
    mutationFn: ({ collectionId, detailLayout }) =>
      patchCollectionDetailLayoutRequest(collectionId, detailLayout),
    onSuccess: (collection) => {
      qc.setQueryData([ADMIN_QUERY_KEYS.COLLECTION, siteId, collection.id], collection);
    },
  });
};

export const useDeleteCollection = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: true }, unknown, string>({
    mutationFn: (id) => deleteCollectionRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.COLLECTIONS, siteId] }),
  });
};

// -- items -------------------------------------------------------------------

export const useItems = (collectionId: string | null, params: ListItemsParams) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<ItemsPage>({
    queryKey: [ADMIN_QUERY_KEYS.COLLECTION_ITEMS, siteId, collectionId, params],
    queryFn: () => listItemsRequest(collectionId as string, params),
    enabled: !!siteId && !!collectionId,
  });
};

export const useItem = (collectionId: string | null, itemId: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<CollectionItem>({
    queryKey: [ADMIN_QUERY_KEYS.COLLECTION_ITEM, siteId, collectionId, itemId],
    queryFn: () => getItemRequest(collectionId as string, itemId as string),
    enabled: !!siteId && !!collectionId && !!itemId,
  });
};

const invalidateItems = (
  qc: ReturnType<typeof useQueryClient>,
  siteId: string | null,
  collectionId: string,
): void => {
  void qc.invalidateQueries({
    queryKey: [ADMIN_QUERY_KEYS.COLLECTION_ITEMS, siteId, collectionId],
  });
};

export const useCreateItem = (collectionId: string) => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<CollectionItem, unknown, CreateItemPayload>({
    mutationFn: (payload) => createItemRequest(collectionId, payload),
    onSuccess: () => invalidateItems(qc, siteId, collectionId),
  });
};

export const useUpdateItem = (collectionId: string) => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<CollectionItem, unknown, { itemId: string; payload: UpdateItemPayload }>({
    mutationFn: ({ itemId, payload }) => updateItemRequest(collectionId, itemId, payload),
    onSuccess: (_d, { itemId }) => {
      invalidateItems(qc, siteId, collectionId);
      void qc.invalidateQueries({
        queryKey: [ADMIN_QUERY_KEYS.COLLECTION_ITEM, siteId, collectionId, itemId],
      });
    },
  });
};

export const usePublishItem = (collectionId: string) => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<CollectionItem, unknown, string>({
    mutationFn: (itemId) => publishItemRequest(collectionId, itemId),
    onSuccess: () => invalidateItems(qc, siteId, collectionId),
  });
};

export const useUnpublishItem = (collectionId: string) => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<CollectionItem, unknown, string>({
    mutationFn: (itemId) => unpublishItemRequest(collectionId, itemId),
    onSuccess: () => invalidateItems(qc, siteId, collectionId),
  });
};

export const useDeleteItem = (collectionId: string) => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: true }, unknown, string>({
    mutationFn: (itemId) => deleteItemRequest(collectionId, itemId),
    onSuccess: () => invalidateItems(qc, siteId, collectionId),
  });
};

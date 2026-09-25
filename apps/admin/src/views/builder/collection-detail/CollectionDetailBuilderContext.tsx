import * as React from "react";
import type { CollectionField, CollectionItem } from "@/views/collections/types";

/**
 * Collection Detail Builder context — active only when authoring a collection's
 * shared `/c/{collection}/{item}` layout. Exposes the current collection's field
 * schema so root-level blocks can bind props (Heading → title, etc.) without
 * living inside a Repeater.
 */
export interface CollectionDetailBuilderContextValue {
  collectionId: string;
  collectionSlug: string;
  fields: CollectionField[];
  /** Sample item whose `data` drives canvas preview bindings; optional until loaded. */
  previewItem?: CollectionItem | null;
}

const CollectionDetailBuilderContext =
  React.createContext<CollectionDetailBuilderContextValue | null>(null);

export const useCollectionDetailBuilderContext =
  (): CollectionDetailBuilderContextValue | null =>
    React.useContext(CollectionDetailBuilderContext);

export const CollectionDetailBuilderContextProvider: React.FC<{
  value: CollectionDetailBuilderContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <CollectionDetailBuilderContext.Provider value={value}>
    {children}
  </CollectionDetailBuilderContext.Provider>
);

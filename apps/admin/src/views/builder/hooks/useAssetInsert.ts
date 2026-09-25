import * as React from "react";
import { useEditor } from "@craftjs/core";
import type { MediaItem } from "@/views/media/types";
import { resolver } from "../craft/resolver";
import { useBlockInsert } from "./useBlockInsert";

/** Map a library MediaItem → block prop overrides (image or video). */
export const mediaItemToBlockProps = (item: MediaItem): Record<string, unknown> | null => {
  if (!item.url || item.status !== "ready") return null;
  if (item.type.startsWith("video/")) {
    return { src: item.url, provider: "file" };
  }
  if (item.type.startsWith("image/")) {
    return {
      imageUrl: item.url,
      altText: item.alt ?? "",
      variants: Array.isArray(item.variants) && item.variants.length ? item.variants : undefined,
      intrinsicWidth: item.width ?? undefined,
      intrinsicHeight: item.height ?? undefined,
      focalPoint: item.focalPoint ?? undefined,
    };
  }
  return null;
};

export const blockNameForMedia = (item: MediaItem): "Image" | "Video" | null => {
  if (!item.url || item.status !== "ready") return null;
  if (item.type.startsWith("video/")) return "Video";
  if (item.type.startsWith("image/")) return "Image";
  return null;
};

/**
 * Drag / click-to-insert assets from the left Assets panel onto the canvas.
 */
export const useAssetInsert = () => {
  const { connectors } = useEditor();
  const { makeElement, insert } = useBlockInsert();

  const makeAssetElement = React.useCallback(
    (item: MediaItem) => {
      const block = blockNameForMedia(item);
      const props = mediaItemToBlockProps(item);
      if (!block || !props) return null;
      return makeElement(block, props);
    },
    [makeElement],
  );

  const insertAsset = React.useCallback(
    (item: MediaItem) => {
      const block = blockNameForMedia(item);
      const props = mediaItemToBlockProps(item);
      if (!block || !props) return;
      insert(block, props);
    },
    [insert],
  );

  const attachAssetDrag = React.useCallback(
    (item: MediaItem) => (ref: HTMLElement | null) => {
      const el = makeAssetElement(item);
      if (ref && el) connectors.create(ref, el);
    },
    [connectors, makeAssetElement],
  );

  return { makeAssetElement, insertAsset, attachAssetDrag };
};

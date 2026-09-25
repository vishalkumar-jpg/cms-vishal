import { create } from "zustand";
import type { MediaItem } from "@/views/media/types";
import { useEditorUiStore } from "./editorUiStore";

export type AssetPickFilter = "image" | "video" | "any";

interface AssetPickState {
  pending: ((item: MediaItem | null) => void) | null;
  filter: AssetPickFilter;
  /** Switch to the Assets tab and wait for the user to click a tile. */
  open: (filter?: AssetPickFilter) => Promise<MediaItem | null>;
  pick: (item: MediaItem) => void;
  cancel: () => void;
}

/**
 * Builder-scoped asset picker — routes image/video fields to the left Assets
 * panel instead of a modal. Resolves when the user clicks a tile (or cancels).
 */
export const useAssetPickStore = create<AssetPickState>((set, get) => ({
  pending: null,
  filter: "any",
  open: (filter = "any") => {
    useEditorUiStore.getState().setLeftTab("assets");
    return new Promise<MediaItem | null>((resolve) => {
      set({ pending: resolve, filter });
    });
  },
  pick: (item) => {
    get().pending?.(item);
    set({ pending: null, filter: "any" });
  },
  cancel: () => {
    get().pending?.(null);
    set({ pending: null, filter: "any" });
  },
}));

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LayerFolderDef {
  id: string;
  name: string;
  color?: string;
  collapsed?: boolean;
  hidden?: boolean;
  locked?: boolean;
  parentId?: string | null;
}

interface LayerFolderState {
  folders: LayerFolderDef[];
  collapsedFolderIds: string[];
  createFolder: (name: string, parentId?: string | null) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  setFolderColor: (id: string, color: string | null) => void;
  toggleFolderCollapsed: (id: string) => void;
  setFolderHidden: (id: string, hidden: boolean) => void;
  setFolderLocked: (id: string, locked: boolean) => void;
  moveFolder: (id: string, parentId: string | null) => void;
}

const uid = (): string => `lf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useLayerFolderStore = create<LayerFolderState>()(
  persist(
    (set, get) => ({
      folders: [],
      collapsedFolderIds: [],
      createFolder: (name, parentId = null) => {
        const id = uid();
        set((s) => ({
          folders: [...s.folders, { id, name: name.trim() || "Folder", parentId: parentId ?? null }],
        }));
        return id;
      },
      renameFolder: (id, name) =>
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)),
        })),
      deleteFolder: (id) =>
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id && f.parentId !== id),
          collapsedFolderIds: s.collapsedFolderIds.filter((x) => x !== id),
        })),
      setFolderColor: (id, color) =>
        set((s) => ({
          folders: s.folders.map((f) => {
            if (f.id !== id) return f;
            const next = { ...f };
            if (color) next.color = color;
            else delete next.color;
            return next;
          }),
        })),
      toggleFolderCollapsed: (id) =>
        set((s) => ({
          collapsedFolderIds: s.collapsedFolderIds.includes(id)
            ? s.collapsedFolderIds.filter((x) => x !== id)
            : [...s.collapsedFolderIds, id],
        })),
      setFolderHidden: (id, hidden) =>
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, hidden } : f)),
        })),
      setFolderLocked: (id, locked) =>
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, locked } : f)),
        })),
      moveFolder: (id, parentId) =>
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, parentId } : f)),
        })),
    }),
    { name: "ob-builder-layer-folders" },
  ),
);

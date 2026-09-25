import { create } from "zustand";

/**
 * Collaboration UI state for the builder round (COLLAB): comment mode + which
 * thread popover is open, and the find-&-replace panel toggle. Kept separate
 * from `editorUiStore` (which owns core canvas UI) so this feature is additive
 * and self-contained.
 */
/** A pending pin drop awaiting its first comment body. */
export type PendingPin =
  | { nodeId: string; anchorX: null; anchorY: null }
  | { nodeId: null; anchorX: number; anchorY: number };

interface CollabState {
  /** When true, clicking a block / canvas point drops a new comment pin. */
  commentMode: boolean;
  setCommentMode: (on: boolean) => void;
  toggleCommentMode: () => void;

  /** The comment panel (drawer) open state. */
  commentsPanelOpen: boolean;
  setCommentsPanelOpen: (open: boolean) => void;

  /** The thread whose popover is open (root comment id), or null. */
  openThreadId: string | null;
  setOpenThreadId: (id: string | null) => void;

  /** A pending pin drop at a raw canvas point (fractions) awaiting the first body. */
  pendingPin: PendingPin | null;
  setPendingPin: (p: PendingPin | null) => void;

  /** The find & replace panel open state. */
  findOpen: boolean;
  setFindOpen: (open: boolean) => void;
}

export const useCollabStore = create<CollabState>((set) => ({
  commentMode: false,
  setCommentMode: (on) => set({ commentMode: on }),
  toggleCommentMode: () => set((s) => ({ commentMode: !s.commentMode })),

  commentsPanelOpen: false,
  setCommentsPanelOpen: (open) => set({ commentsPanelOpen: open }),

  openThreadId: null,
  setOpenThreadId: (id) => set({ openThreadId: id }),

  pendingPin: null,
  setPendingPin: (p) => set({ pendingPin: p }),

  findOpen: false,
  setFindOpen: (open) => set({ findOpen: open }),
}));

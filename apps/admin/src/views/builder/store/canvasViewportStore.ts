import { create } from "zustand";

/** Shared canvas scroll container + frame metrics for rulers/grid overlays. */
interface CanvasViewportState {
  scrollEl: HTMLElement | null;
  setScrollEl: (el: HTMLElement | null) => void;
  frameRect: DOMRect | null;
  setFrameRect: (rect: DOMRect | null) => void;
  cursor: { x: number; y: number } | null;
  setCursor: (pt: { x: number; y: number } | null) => void;
  scrollLeft: number;
  scrollTop: number;
  setScroll: (left: number, top: number) => void;
}

export const useCanvasViewportStore = create<CanvasViewportState>((set) => ({
  scrollEl: null,
  setScrollEl: (scrollEl) => set({ scrollEl }),
  frameRect: null,
  setFrameRect: (frameRect) => set({ frameRect }),
  cursor: null,
  setCursor: (cursor) => set({ cursor }),
  scrollLeft: 0,
  scrollTop: 0,
  setScroll: (scrollLeft, scrollTop) => set({ scrollLeft, scrollTop }),
}));

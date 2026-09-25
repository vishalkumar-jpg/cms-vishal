import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Breakpoint } from "../property/styleTokens";

export type LeftSidebarTab =
  | "blocks"
  | "sections"
  | "assets"
  | "layers"
  | "templates"
  | "reusable";

/**
 * Builder editing mode:
 *  - `structure` : full layout editing — drag/reorder, resize handles, spacing
 *                  bands, snap guides (the default power-user surface).
 *  - `content`   : safe copy-editing — selection + inline text/image edits only;
 *                  dragging, resizing and spacing manipulation are disabled so a
 *                  non-designer can't accidentally break the layout.
 */
export type EditMode = "structure" | "content";

/**
 * Interface complexity level — controls how many controls a user sees so
 * beginners aren't overwhelmed (the "reduce cognitive load" principle):
 *  - `simple`   : only essential, plain-English controls.
 *  - `advanced` : everything (power users). Expert reserved for future raw/CSS.
 */
export type UiLevel = "simple" | "advanced" | "expert";

export type PreviewOrientation = "portrait" | "landscape";

export type PreviewDevice =
  | "largeDesktop"
  | "desktop"
  | "laptop"
  | "tablet"
  | "tabletLandscape"
  | "mobile"
  | "mobileLandscape";

/**
 * A selected sub-part INSIDE a block (e.g. the title/image/button of a Hero
 * card). Sub-parts are not Craft nodes — they're regions of a single node's DOM
 * tagged with `data-subpart` — so we track the selection here. Paths point at
 * the owning node's props: `textPath` for editable text, `stylePath` for the
 * per-part StyleModel bag, `imagePath` for the image url.
 */
export interface SelectedSubPart {
  nodeId: string;
  key: string;
  label: string;
  textPath?: string;
  stylePath?: string;
  imagePath?: string;
}

/** Editor-only UI state (NOT Craft tree state, which Craft owns). */
interface EditorUiState {
  breakpoint: Breakpoint;
  setBreakpoint: (bp: Breakpoint) => void;
  /** Interaction mode gate. Defaults to `structure`. */
  editMode: EditMode;
  setEditMode: (m: EditMode) => void;
  toggleEditMode: () => void;
  /** Currently selected sub-part within a block (null = whole block). */
  subPart: SelectedSubPart | null;
  setSubPart: (p: SelectedSubPart | null) => void;
  clearSubPart: () => void;
  leftTab: LeftSidebarTab;
  setLeftTab: (t: LeftSidebarTab) => void;
  /**
   * Builder-scoped clipboard: a serialized node subtree (NOT the OS clipboard),
   * so copy/paste works across the toolbar, context menu and keyboard shortcuts.
   */
  clipboard: string | null;
  setClipboard: (c: string | null) => void;
  /**
   * Extra selected node ids ON TOP of Craft's own single selection (which stays
   * the "primary"). Shift+Click adds here; delete/duplicate act on the union.
   */
  extraSelected: string[];
  toggleExtraSelected: (id: string) => void;
  setExtraSelected: (ids: string[]) => void;
  clearExtraSelected: () => void;

  /* ---- Learnability / non-technical UX --------------------------------- */
  /** Help mode: hovering a control shows a plain-English explanation. */
  helpMode: boolean;
  toggleHelpMode: () => void;
  setHelpMode: (v: boolean) => void;
  /** Show one-line "what it's for" descriptions under each block in the palette. */
  showDescriptions: boolean;
  toggleShowDescriptions: () => void;
  /** How many controls to expose. `simple` hides advanced/technical sections. */
  uiLevel: UiLevel;
  setUiLevel: (l: UiLevel) => void;
  /**
   * Show the on-canvas accessibility warning badges (red/amber "!" dots). These
   * are editor-only hints and never render on the published page. Off by default
   * so the canvas stays clean; users opt in from the toolbar.
   */
  showA11yMarkers: boolean;
  toggleA11yMarkers: () => void;
  setShowA11yMarkers: (v: boolean) => void;

  /**
   * Monotonic counter bumped whenever Craft's node tree actually changes (via
   * `<Editor onNodesChange>`). Autosave reads it to skip serializing the (large)
   * tree when nothing changed — replacing a constant 500ms serialize poll that
   * ran even while the page was idle. Not used as a render selector.
   */
  dirtyVersion: number;
  bumpDirty: () => void;

  /** User-pinned favorite blocks in the palette (persisted). */
  favoriteBlocks: string[];
  toggleFavoriteBlock: (name: string) => void;
  isFavoriteBlock: (name: string) => boolean;
  /** Pinned section preset ids (persisted). */
  pinnedSections: string[];
  togglePinnedSection: (id: string) => void;
  /** Last inserted block types (most recent first, max 8, persisted). */
  recentBlocks: string[];
  pushRecentBlock: (name: string) => void;
  /** Clipboard for copying animation settings between blocks. */
  animationClipboard: Record<string, unknown> | null;
  setAnimationClipboard: (v: Record<string, unknown> | null) => void;
  /** Clipboard for copy/paste styles between blocks. */
  styleClipboard: Record<string, unknown> | null;
  setStyleClipboard: (v: Record<string, unknown> | null) => void;
  /** Show grid overlay on canvas. */
  showGridOverlay: boolean;
  toggleGridOverlay: () => void;
  /** Show responsive issue markers on canvas. */
  showResponsiveMarkers: boolean;
  toggleResponsiveMarkers: () => void;
  /** Side-by-side responsive compare (tablet + mobile previews). */
  responsiveCompare: boolean;
  toggleResponsiveCompare: () => void;
  /** Preview interaction state on selected block (hover/focus/etc). */
  stylePreviewState: string | null;
  setStylePreviewState: (s: string | null) => void;
  /** Custom canvas preview widths (px) keyed by breakpoint name. */
  customBreakpointWidths: Partial<Record<Breakpoint, number>>;
  setCustomBreakpointWidth: (bp: Breakpoint, width: number | null) => void;
  /** Show pixel rulers around the canvas. */
  showRulers: boolean;
  toggleRulers: () => void;
  /** Device preview orientation (tablet/mobile). */
  previewOrientation: PreviewOrientation;
  setPreviewOrientation: (o: PreviewOrientation) => void;
  togglePreviewOrientation: () => void;
  /** Canvas zoom factor (future-proof; 1 = 100%). */
  canvasZoom: number;
  setCanvasZoom: (z: number) => void;
  /** Collapse left sidebar (mobile / narrow screens). */
  leftPanelCollapsed: boolean;
  toggleLeftPanel: () => void;
  /** Collapse property panel. */
  rightPanelCollapsed: boolean;
  toggleRightPanel: () => void;
  /** First-run onboarding completed. */
  onboardingCompleted: boolean;
  setOnboardingCompleted: (v: boolean) => void;
  /** Help center drawer open. */
  helpCenterOpen: boolean;
  setHelpCenterOpen: (v: boolean) => void;
  /** Unsaved edits flag for leave-page warning. */
  hasUnsavedEdits: boolean;
  setHasUnsavedEdits: (v: boolean) => void;
  /** True while a confirm/alert modal is open (suppress builder selection chrome). */
  modalDialogOpen: boolean;
  setModalDialogOpen: (v: boolean) => void;
}

export const useEditorUiStore = create<EditorUiState>()(
  persist(
    (set, get) => ({
  breakpoint: "desktop",
  setBreakpoint: (bp) => set({ breakpoint: bp }),
  editMode: "structure",
  setEditMode: (m) => set({ editMode: m }),
  toggleEditMode: () =>
    set((s) => ({ editMode: s.editMode === "structure" ? "content" : "structure" })),
  subPart: null,
  setSubPart: (p) => set({ subPart: p }),
  clearSubPart: () => set({ subPart: null }),
  leftTab: "blocks",
  setLeftTab: (t) => set({ leftTab: t }),
  clipboard: null,
  setClipboard: (c) => set({ clipboard: c }),
  extraSelected: [],
  toggleExtraSelected: (id) =>
    set((s) => ({
      extraSelected: s.extraSelected.includes(id)
        ? s.extraSelected.filter((x) => x !== id)
        : [...s.extraSelected, id],
    })),
  setExtraSelected: (ids) => set({ extraSelected: ids }),
  clearExtraSelected: () => set({ extraSelected: [] }),

  helpMode: false,
  toggleHelpMode: () => set((s) => ({ helpMode: !s.helpMode })),
  setHelpMode: (v) => set({ helpMode: v }),
  showDescriptions: true,
  toggleShowDescriptions: () => set((s) => ({ showDescriptions: !s.showDescriptions })),
  uiLevel: "simple",
  setUiLevel: (l) => set({ uiLevel: l }),
  showA11yMarkers: false,
  toggleA11yMarkers: () => set((s) => ({ showA11yMarkers: !s.showA11yMarkers })),
  setShowA11yMarkers: (v) => set({ showA11yMarkers: v }),
  dirtyVersion: 0,
  bumpDirty: () => set((s) => ({ dirtyVersion: s.dirtyVersion + 1 })),
  favoriteBlocks: [],
  toggleFavoriteBlock: (name) =>
    set((s) => ({
      favoriteBlocks: s.favoriteBlocks.includes(name)
        ? s.favoriteBlocks.filter((x) => x !== name)
        : [...s.favoriteBlocks, name],
    })),
  isFavoriteBlock: (name) => get().favoriteBlocks.includes(name),
  pinnedSections: [],
  togglePinnedSection: (id) =>
    set((s) => ({
      pinnedSections: s.pinnedSections.includes(id)
        ? s.pinnedSections.filter((x) => x !== id)
        : [...s.pinnedSections, id],
    })),
  recentBlocks: [],
  pushRecentBlock: (name) =>
    set((s) => {
      const next = [name, ...s.recentBlocks.filter((x) => x !== name)].slice(0, 8);
      return { recentBlocks: next };
    }),
  animationClipboard: null,
  setAnimationClipboard: (v) => set({ animationClipboard: v }),
  styleClipboard: null,
  setStyleClipboard: (v) => set({ styleClipboard: v }),
  showGridOverlay: false,
  toggleGridOverlay: () => set((s) => ({ showGridOverlay: !s.showGridOverlay })),
  showResponsiveMarkers: false,
  toggleResponsiveMarkers: () => set((s) => ({ showResponsiveMarkers: !s.showResponsiveMarkers })),
  responsiveCompare: false,
  toggleResponsiveCompare: () => set((s) => ({ responsiveCompare: !s.responsiveCompare })),
  stylePreviewState: null,
  setStylePreviewState: (s) => set({ stylePreviewState: s }),
  customBreakpointWidths: {},
  setCustomBreakpointWidth: (bp, width) =>
    set((s) => {
      const next = { ...s.customBreakpointWidths };
      if (width == null) delete next[bp];
      else next[bp] = width;
      return { customBreakpointWidths: next };
    }),
  showRulers: false,
  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  previewOrientation: "portrait",
  setPreviewOrientation: (o) => set({ previewOrientation: o }),
  togglePreviewOrientation: () =>
    set((s) => ({
      previewOrientation: s.previewOrientation === "portrait" ? "landscape" : "portrait",
    })),
  canvasZoom: 1,
  setCanvasZoom: (canvasZoom) => set({ canvasZoom: Math.min(2, Math.max(0.5, canvasZoom)) }),
  leftPanelCollapsed: false,
  toggleLeftPanel: () => set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
  rightPanelCollapsed: false,
  toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
  onboardingCompleted: false,
  setOnboardingCompleted: (v) => set({ onboardingCompleted: v }),
  helpCenterOpen: false,
  setHelpCenterOpen: (v) => set({ helpCenterOpen: v }),
  hasUnsavedEdits: false,
  setHasUnsavedEdits: (v) => set({ hasUnsavedEdits: v }),
  modalDialogOpen: false,
  setModalDialogOpen: (v) => set({ modalDialogOpen: v }),
    }),
    {
      name: "ob-builder-ui",
      partialize: (s) => ({
        favoriteBlocks: s.favoriteBlocks,
        pinnedSections: s.pinnedSections,
        recentBlocks: s.recentBlocks,
        showDescriptions: s.showDescriptions,
        uiLevel: s.uiLevel,
        helpMode: s.helpMode,
        leftTab: s.leftTab,
        previewOrientation: s.previewOrientation,
        onboardingCompleted: s.onboardingCompleted,
        customBreakpointWidths: s.customBreakpointWidths,
      }),
    },
  ),
);

/** Default preview heights for portrait device frames. */
export const BREAKPOINT_HEIGHT: Partial<Record<Breakpoint, number>> = {
  tablet: 1024,
  mobile: 844,
  laptop: 768,
  largeDesktop: 900,
};

export interface PreviewDimensions {
  width: number | null;
  height: number | null;
  orientation: PreviewOrientation;
}

/** Resolve canvas preview width + height with orientation support. */
export const resolvePreviewDimensions = (
  bp: Breakpoint,
  custom: Partial<Record<Breakpoint, number>> = {},
  orientation: PreviewOrientation = "portrait",
): PreviewDimensions => {
  const baseW = resolveBreakpointWidth(bp, custom);
  const baseH = BREAKPOINT_HEIGHT[bp] ?? null;

  if (bp === "desktop" || baseW == null) {
    return { width: baseW, height: null, orientation };
  }

  if (orientation === "landscape" && baseW != null && baseH != null) {
    return { width: baseH, height: baseW, orientation: "landscape" };
  }

  return { width: baseW, height: baseH, orientation: "portrait" };
};

export const BREAKPOINT_WIDTH: Record<Breakpoint, number | null> = {
  largeDesktop: 1440,
  desktop: null,
  laptop: 1024,
  tablet: 768,
  mobile: 390,
};

/** Resolve canvas width including custom overrides. */
export const resolveBreakpointWidth = (
  bp: Breakpoint,
  custom: Partial<Record<Breakpoint, number>> = {},
): number | null => {
  if (custom[bp] != null) return custom[bp]!;
  return BREAKPOINT_WIDTH[bp];
};

/** Style override key — one independent layer per preview device. */
export const styleBreakpointKey = (bp: Breakpoint): Breakpoint => bp;

/** Coarse viewport bucket for `data-ob-viewport` (navbar / layout components). */
export const viewportModeForBreakpoint = (
  bp: Breakpoint,
): "mobile" | "tablet" | "desktop" => {
  if (bp === "mobile") return "mobile";
  if (bp === "tablet") return "tablet";
  return "desktop";
};

import * as React from "react";
import type { DistanceBadge, Guide } from "./geometry";

/** What an active drag interaction publishes for the shared guide/badge layer. */
export interface DragFeedback {
  guides: Guide[];
  badges: DistanceBadge[];
}

interface OverlayDragState {
  /** True while a resize/spacing/move gesture is in progress. */
  active: boolean;
  feedback: DragFeedback;
  setActive: (a: boolean) => void;
  setFeedback: (f: DragFeedback) => void;
}

const noop = (): void => {};

export const OverlayDragContext = React.createContext<OverlayDragState>({
  active: false,
  feedback: { guides: [], badges: [] },
  setActive: noop,
  setFeedback: noop,
});

export const useOverlayDrag = (): OverlayDragState => React.useContext(OverlayDragContext);

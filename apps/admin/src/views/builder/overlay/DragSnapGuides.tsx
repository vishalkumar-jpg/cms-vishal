import * as React from "react";
import { useEditor } from "@craftjs/core";
import { useOverlayDrag } from "./dragContext";
import { computeRectSnap, distanceBadges, rectOf, type Rect } from "./geometry";
import { useRafThrottle } from "./useOverlayMeasure";

/**
 * Publishes alignment snap guides + distance badges while Craft is dragging an
 * existing block (reorder / reparent). Palette-item drags only get the drop
 * indicator — there's no positioned element to align yet.
 *
 * Read-only: we never mutate the drag — Craft still performs the move on drop.
 * We only render magenta edge/center guides and px gap badges from geometry.
 */
export const DragSnapGuides: React.FC = () => {
  const { query } = useEditor();
  const drag = useOverlayDrag();
  const { schedule } = useRafThrottle();

  // Read drag through a ref so the publish effect never lists `drag` as a
  // dependency — the context value changes identity on every feedback update,
  // and depending on it would re-run this effect in a tight loop.
  const dragRef = React.useRef(drag);
  dragRef.current = drag;

  const draggedIds = useEditor((state) => [...state.events.dragged]);
  const isDragging = draggedIds.length > 0;

  const measure = React.useCallback((): { moving: Rect | null; targets: Rect[] } => {
    const ids = query.getEvent("dragged").all();
    const id = ids[0];
    if (!id) return { moving: null, targets: [] };
    let node;
    try {
      node = query.node(id).get();
    } catch {
      return { moving: null, targets: [] };
    }
    const dom = node.dom;
    if (!dom) return { moving: null, targets: [] };

    const moving = rectOf(dom);
    const parentId = node.data.parent ?? null;
    let parentNode;
    try {
      parentNode = parentId ? query.node(parentId).get() : undefined;
    } catch {
      parentNode = undefined;
    }
    const siblingIds = parentNode
      ? parentNode.data.nodes.filter((s) => s !== id && !ids.includes(s))
      : [];
    const targets: Rect[] = [];
    for (const sid of siblingIds) {
      try {
        const sdom = query.node(sid).get().dom;
        if (sdom) targets.push(rectOf(sdom));
      } catch {
        /* sibling gone */
      }
    }
    if (parentNode?.dom) targets.push(rectOf(parentNode.dom));
    return { moving, targets };
  }, [query]);

  React.useEffect(() => {
    if (!isDragging) {
      if (!dragRef.current.active) dragRef.current.setFeedback({ guides: [], badges: [] });
      return;
    }

    const publish = (): void => {
      if (dragRef.current.active) return;
      schedule(() => {
        if (dragRef.current.active) return;
        const { moving, targets } = measure();
        if (!moving) return;
        const snap = computeRectSnap(moving, targets);
        const badges = distanceBadges(moving, targets);
        dragRef.current.setFeedback({ guides: snap.guides, badges });
      });
    };

    publish();
    window.addEventListener("pointermove", publish, true);
    window.addEventListener("dragover", publish, true);
    return () => {
      window.removeEventListener("pointermove", publish, true);
      window.removeEventListener("dragover", publish, true);
      if (!dragRef.current.active) dragRef.current.setFeedback({ guides: [], badges: [] });
    };
  }, [isDragging, measure, schedule]);

  return null;
};

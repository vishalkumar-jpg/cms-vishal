import * as React from "react";
import { useEditor } from "@craftjs/core";
import { useSiteStore } from "@/store/siteStore";
import { useCollabStore } from "../store/collabStore";
import { usePageComments } from "./useComments";
import { CommentThreadPopover } from "./CommentThreadPopover";
import { CommentPinCompose } from "./CommentPinCompose";
import { initials } from "./commentUtils";
import type { CommentRow } from "./comments.api";

/**
 * COLLAB — a lightweight, fixed-position overlay that paints comment pins on top
 * of the canvas. It NEVER touches the Craft canvas / direct-manipulation overlay:
 * it only READS each anchored node's real DOM rect (`state.nodes[id].dom`) and
 * the ROOT rect (for free canvas-point pins). Pins reposition on scroll/resize.
 *
 * In comment mode, a full-canvas capture layer intercepts a click and drops a
 * pending pin (on the clicked block, or a free canvas point) which opens an
 * inline compose box.
 */
interface CommentsOverlayProps {
  pageId: string | null;
}

export const CommentsOverlay: React.FC<CommentsOverlayProps> = ({ pageId }) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const commentMode = useCollabStore((s) => s.commentMode);
  const pendingPin = useCollabStore((s) => s.pendingPin);
  const setPendingPin = useCollabStore((s) => s.setPendingPin);
  const openThreadId = useCollabStore((s) => s.openThreadId);
  const setOpenThreadId = useCollabStore((s) => s.setOpenThreadId);

  const { data: comments } = usePageComments(siteId, pageId);

  const { nodeDom, rootDom, actions } = useEditor((state) => ({
    // A snapshot of node → dom used to pin badges. Re-read live in render.
    nodeDom: state.nodes,
    rootDom: state.nodes["ROOT"]?.dom ?? null,
  }));

  // Force a re-read of getBoundingClientRect on scroll/resize (mirror the inline
  // toolbar pattern) so pins track the canvas.
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const onChange = (): void => force();
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  const roots = React.useMemo(
    () => (comments ?? []).filter((c) => c.parentId === null),
    [comments],
  );

  // Position a root pin: prefer its node's rect (top-right corner); else a free
  // canvas point resolved against the ROOT rect.
  const pinPos = (c: CommentRow): { top: number; left: number } | null => {
    if (c.nodeId) {
      const dom = nodeDom[c.nodeId]?.dom;
      if (!dom) return null;
      const r = dom.getBoundingClientRect();
      return { top: r.top + 6, left: r.right - 14 };
    }
    if (rootDom && c.anchorX != null && c.anchorY != null) {
      const r = rootDom.getBoundingClientRect();
      return { top: r.top + c.anchorY * r.height, left: r.left + c.anchorX * r.width };
    }
    return null;
  };

  const onCaptureClick = (e: React.MouseEvent): void => {
    // Geometric hit-test against node rects (NOT elementFromPoint — the capture
    // layer would occlude the canvas). Pick the smallest-area node whose rect
    // contains the click point, i.e. the deepest block under the cursor.
    const px = e.clientX;
    const py = e.clientY;
    let nodeId: string | null = null;
    let bestArea = Infinity;
    for (const [id, n] of Object.entries(nodeDom)) {
      if (id === "ROOT" || !n.dom) continue;
      const r = n.dom.getBoundingClientRect();
      if (px < r.left || px > r.right || py < r.top || py > r.bottom) continue;
      const area = r.width * r.height;
      if (area < bestArea) {
        bestArea = area;
        nodeId = id;
      }
    }
    if (nodeId) {
      setPendingPin({ nodeId, anchorX: null, anchorY: null });
    } else if (rootDom) {
      const r = rootDom.getBoundingClientRect();
      const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      const y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
      setPendingPin({ nodeId: null, anchorX: x, anchorY: y });
    }
  };

  const pendingPos = ((): { top: number; left: number } | null => {
    if (!pendingPin) return null;
    if (pendingPin.nodeId) {
      const dom = nodeDom[pendingPin.nodeId]?.dom;
      if (!dom) return null;
      const r = dom.getBoundingClientRect();
      return { top: r.top + 6, left: r.right - 14 };
    }
    if (rootDom) {
      const r = rootDom.getBoundingClientRect();
      return {
        top: r.top + (pendingPin.anchorY ?? 0) * r.height,
        left: r.left + (pendingPin.anchorX ?? 0) * r.width,
      };
    }
    return null;
  })();

  return (
    <>
      {/* Comment-mode capture layer: intercepts one click to drop a pin. */}
      {commentMode && !pendingPin && (
        <div
          className="fixed inset-0 z-40 cursor-crosshair"
          onClick={onCaptureClick}
          title="Click a block or a spot on the canvas to leave a comment"
        />
      )}

      {/* Existing thread pins. */}
      {roots.map((c) => {
        const pos = pinPos(c);
        if (!pos) return null;
        return (
          <button
            key={c.id}
            type="button"
            className={`fixed z-40 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-md ${
              c.resolved ? "bg-emerald-500 opacity-70" : "bg-amber-500"
            }`}
            style={{ top: pos.top, left: pos.left }}
            title={`${c.authorName ?? c.authorEmail ?? "Comment"}: ${c.body}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenThreadId(openThreadId === c.id ? null : c.id);
            }}
          >
            {initials(c.authorName, c.authorEmail)}
          </button>
        );
      })}

      {/* Open thread popover. */}
      {openThreadId && (
        <CommentThreadPopover
          rootId={openThreadId}
          siteId={siteId}
          pageId={pageId}
          anchor={(() => {
            const root = roots.find((r) => r.id === openThreadId);
            return root ? pinPos(root) : null;
          })()}
          onClose={() => setOpenThreadId(null)}
          onSelectNode={(nodeId) => {
            if (!nodeId) return;
            const dom = nodeDom[nodeId]?.dom;
            if (!dom) return;
            try {
              actions.selectNode(nodeId);
              dom.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch {
              /* node may no longer exist */
            }
          }}
        />
      )}

      {/* Inline compose for a freshly-dropped pin. */}
      {pendingPin && pendingPos && (
        <CommentPinCompose
          siteId={siteId}
          pageId={pageId}
          pin={pendingPin}
          anchor={pendingPos}
          onDone={() => {
            setPendingPin(null);
          }}
        />
      )}
    </>
  );
};

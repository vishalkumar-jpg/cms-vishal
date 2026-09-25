import * as React from "react";
import { Frame, Element } from "@craftjs/core";
import { OBSiteRoot } from "@ob-cms/blocks";
import "@ob-cms/blocks/blocks.css";
import { RootFrame } from "../craft/resolver";
import {
  useEditorUiStore,
  resolvePreviewDimensions,
  viewportModeForBreakpoint,
} from "../store/editorUiStore";
import { useCanvasViewportStore } from "../store/canvasViewportStore";
import { useTheme } from "@/views/theme/hooks/useTheme";
import { themeTokensToCanvasVars } from "../craft/themeVars";
import { PreviewFormProvider } from "./PreviewFormProvider";
import { PreviewReusableBlockProvider } from "./PreviewReusableBlockProvider";
import { PreviewCollectionProvider } from "./PreviewCollectionProvider";
import { expandLayoutComposites } from "../sections/expandComposite";
import { hydrateNavbarNodes, hydratePartnersLogoGrid } from "@ob-cms/blocks";
import { useBuilderPageNavigation } from "../hooks/useBuilderPageNavigation";

interface CanvasProps {
  initialJson: string | null;
  /** When set, Craft Frame remounts only on page navigation (not autosave). */
  pageId?: string | null;
}

export const Canvas: React.FC<CanvasProps> = ({ initialJson, pageId = null }) => {
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const customWidths = useEditorUiStore((s) => s.customBreakpointWidths);
  const previewOrientation = useEditorUiStore((s) => s.previewOrientation);
  const canvasZoom = useEditorUiStore((s) => s.canvasZoom);
  const setScrollEl = useCanvasViewportStore((s) => s.setScrollEl);
  const setFrameRect = useCanvasViewportStore((s) => s.setFrameRect);
  const setScroll = useCanvasViewportStore((s) => s.setScroll);
  const setCursor = useCanvasViewportStore((s) => s.setCursor);

  const scrollRef = React.useCallback(
    (el: HTMLDivElement | null) => setScrollEl(el),
    [setScrollEl],
  );
  const frameRef = React.useRef<HTMLDivElement>(null);

  const dims = resolvePreviewDimensions(breakpoint, customWidths, previewOrientation);
  const { data: theme } = useTheme();
  const { onLinkClickCapture, onLinkDoubleClickCapture } = useBuilderPageNavigation("editor");

  const themeStyle = React.useMemo(
    () => themeTokensToCanvasVars(theme?.tokens),
    [theme?.tokens],
  );

  const hydratedJson = React.useMemo(() => {
    if (!initialJson) return initialJson;
    try {
      const nodes = JSON.parse(initialJson) as Record<string, unknown>;
      const steps = [expandLayoutComposites, hydrateNavbarNodes, hydratePartnersLogoGrid] as const;
      let current = nodes;
      let changed = false;
      for (const step of steps) {
        const result = step(current);
        current = result.nodes;
        changed = changed || result.changed;
      }
      return changed ? JSON.stringify(current) : initialJson;
    } catch {
      return initialJson;
    }
  }, [initialJson]);

  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = (): void => setFrameRect(frame.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(frame);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [setFrameRect, dims.width, dims.height, canvasZoom, previewOrientation]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget;
    setScroll(el.scrollLeft, el.scrollTop);
  };

  const onMouseMove = (e: React.MouseEvent): void => {
    setCursor({ x: e.clientX, y: e.clientY });
  };

  const onMouseLeave = (): void => setCursor(null);

  const frameStyle: React.CSSProperties = {
    width: dims.width ? `${dims.width}px` : "100%",
    maxWidth: "100%",
    minHeight: dims.height ? `${dims.height}px` : undefined,
    transform: canvasZoom !== 1 ? `scale(${canvasZoom})` : undefined,
    transformOrigin: "top center",
  };

  return (
    <div
      ref={scrollRef}
      className="builder-canvas-scroll flex h-full flex-col overflow-auto bg-muted/40"
      onScroll={onScroll}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      data-builder-canvas
    >
      <div className="flex flex-1 justify-center p-6">
        <div
          ref={frameRef}
          data-builder-canvas-frame
          className="bg-background shadow-sm transition-[width,min-height] duration-200"
          style={frameStyle}
        >
          <OBSiteRoot
            className="min-h-full"
            viewportMode={viewportModeForBreakpoint(breakpoint)}
            breakpoint={breakpoint}
            data-ob-builder-canvas="true"
          >
            <div
              className="min-h-full"
              style={themeStyle}
              onClickCapture={onLinkClickCapture}
              onDoubleClickCapture={onLinkDoubleClickCapture}
            >
              <PreviewCollectionProvider>
                <PreviewReusableBlockProvider editorCanvas>
                  <PreviewFormProvider>
                    {hydratedJson ? (
                      <Frame key={pageId ?? "new"} data={hydratedJson} />
                    ) : (
                      <Frame key={pageId ?? "new"}>
                        <Element is={RootFrame} canvas />
                      </Frame>
                    )}
                  </PreviewFormProvider>
                </PreviewReusableBlockProvider>
              </PreviewCollectionProvider>
            </div>
          </OBSiteRoot>
        </div>
      </div>
    </div>
  );
};

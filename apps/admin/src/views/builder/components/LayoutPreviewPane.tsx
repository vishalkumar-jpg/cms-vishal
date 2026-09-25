import * as React from "react";
import { LayoutTemplate, Loader2 } from "lucide-react";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { cn } from "@/lib/cn";

const LayoutPreviewRendererLazy = React.lazy(() =>
  import("./LayoutPreviewRenderer").then((m) => ({ default: m.LayoutPreviewRenderer })),
);

const DEFAULT_REFERENCE_WIDTH = 1280;

export type LayoutPreviewPaneProps = {
  layout: SerializedLayout | null | undefined;
  loading?: boolean;
  error?: boolean;
  fallback?: React.ReactNode;
  className?: string;
  referenceWidth?: number;
  label?: string;
};

const PreviewFallback: React.FC<{ message?: string }> = ({ message = "Preview unavailable" }) => (
  <div
    className="flex h-full w-full items-center justify-center text-muted-foreground"
    data-testid="layout-preview-fallback"
  >
    <div className="flex flex-col items-center gap-2 text-center">
      <LayoutTemplate className="h-10 w-10 opacity-40" aria-hidden="true" />
      <p className="text-xs">{message}</p>
    </div>
  </div>
);

/**
 * Scaled, read-only layout preview for dialogs and shelves.
 * Lazy-loads the block renderer so template library routes stay lean.
 */
const LayoutPreviewPaneInner: React.FC<LayoutPreviewPaneProps> = ({
  layout,
  loading = false,
  error = false,
  fallback,
  className,
  referenceWidth = DEFAULT_REFERENCE_WIDTH,
  label,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.3);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = (): void => {
      const width = el.clientWidth;
      if (width > 0) setScale(width / referenceWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [referenceWidth]);

  const memoizedLayout = React.useMemo(() => layout ?? null, [layout]);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden bg-white", className)}
      data-testid="layout-preview-pane"
      data-readonly="true"
    >
      {loading ? (
        <div
          className="flex h-full w-full items-center justify-center text-muted-foreground"
          role="status"
          aria-live="polite"
          data-testid="layout-preview-loading"
        >
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-xs">Loading preview…</span>
        </div>
      ) : error || !memoizedLayout ? (
        (fallback ?? <PreviewFallback />)
      ) : (
        <div
          role="img"
          aria-label={label}
          className="h-full w-full overflow-hidden"
        >
          <div
            inert
            className="pointer-events-none origin-top-left select-none"
            style={{
              width: referenceWidth,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <React.Suspense
              fallback={
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Preparing preview…
                </div>
              }
            >
              <LayoutPreviewRendererLazy layout={memoizedLayout} />
            </React.Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

export const LayoutPreviewPane = React.memo(LayoutPreviewPaneInner);
LayoutPreviewPane.displayName = "LayoutPreviewPane";

import * as React from "react";
import { useEditor } from "@craftjs/core";
import { RenderLayout, blockRegistry, OBSiteRoot, type OBViewportMode } from "@ob-cms/blocks";
import { migrate, type SerializedLayout } from "@ob-cms/block-schema";
import type { Breakpoint } from "../property/styleTokens";
import { useEditorUiStore, resolveBreakpointWidth } from "../store/editorUiStore";
import { useTheme } from "@/views/theme/hooks/useTheme";
import { themeTokensToCanvasVars } from "../craft/themeVars";

/**
 * Side-by-side read-only tablet + mobile previews (editor stays single-canvas).
 */
export const ResponsiveCompareStrip: React.FC = () => {
  const responsiveCompare = useEditorUiStore((s) => s.responsiveCompare);
  const customWidths = useEditorUiStore((s) => s.customBreakpointWidths);
  const dirtyVersion = useEditorUiStore((s) => s.dirtyVersion);
  const { query } = useEditor();
  const { data: theme } = useTheme();

  const themeStyle = React.useMemo(
    () => themeTokensToCanvasVars(theme?.tokens),
    [theme?.tokens],
  );

  const layout = React.useMemo((): SerializedLayout | null => {
    if (!responsiveCompare) return null;
    try {
      return migrate(JSON.parse(query.serialize()) as SerializedLayout);
    } catch {
      return null;
    }
  }, [responsiveCompare, query, dirtyVersion]);

  if (!responsiveCompare || !layout) return null;

  const tabletW = resolveBreakpointWidth("tablet", customWidths) ?? 768;
  const mobileW = resolveBreakpointWidth("mobile", customWidths) ?? 390;

  const Panel: React.FC<{ label: string; width: number; viewportMode: OBViewportMode; bp: Breakpoint }> = ({
    label,
    width,
    viewportMode,
    bp,
  }) => (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-center text-[10px] font-medium uppercase text-muted-foreground">
        {label} ({width}px)
      </p>
      <div
        className="mx-auto overflow-hidden rounded-md border border-border bg-background shadow-sm"
        style={{ width: `${width}px`, maxWidth: "100%" }}
      >
        <OBSiteRoot
          className="pointer-events-none select-none"
          viewportMode={viewportMode}
          breakpoint={bp}
          data-ob-builder-canvas="true"
        >
          <div style={themeStyle}>
            <RenderLayout data={layout} blocks={blockRegistry} wrap={false} repairLegacyLayout />
          </div>
        </OBSiteRoot>
      </div>
    </div>
  );

  return (
    <div className="border-t border-border bg-muted/30 px-6 py-4">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        Responsive compare — read-only previews (edit on the canvas above)
      </p>
      <div className="flex flex-wrap justify-center gap-6">
        <Panel label="Tablet" width={tabletW} viewportMode="tablet" bp="tablet" />
        <Panel label="Mobile" width={mobileW} viewportMode="mobile" bp="mobile" />
      </div>
    </div>
  );
};

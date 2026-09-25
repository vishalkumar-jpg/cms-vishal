import * as React from "react";
import { RenderLayout, blockRegistry, OBSiteRoot } from "@ob-cms/blocks";
import "@ob-cms/blocks/blocks.css";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { useTheme } from "@/views/theme/hooks/useTheme";
import { themeTokensToCanvasVars } from "../craft/themeVars";
import { PreviewCollectionProvider } from "./PreviewCollectionProvider";
import { PreviewFormProvider } from "./PreviewFormProvider";
import { PreviewReusableBlockProvider } from "./PreviewReusableBlockProvider";

export type LayoutPreviewRendererProps = {
  layout: SerializedLayout;
};

/** Eager read-only block render — lazy-loaded by {@link LayoutPreviewPane}. */
export const LayoutPreviewRenderer: React.FC<LayoutPreviewRendererProps> = ({ layout }) => {
  const { data: theme } = useTheme();
  const themeStyle = React.useMemo(
    () => themeTokensToCanvasVars(theme?.tokens),
    [theme?.tokens],
  );

  return (
    <div inert className="pointer-events-none h-full w-full select-none" data-testid="layout-preview-renderer">
      <OBSiteRoot viewportMode="desktop" breakpoint="desktop">
        <PreviewCollectionProvider>
          <PreviewReusableBlockProvider>
            <PreviewFormProvider>
              <div style={themeStyle}>
                <RenderLayout
                  data={layout}
                  blocks={blockRegistry}
                  wrap={false}
                  repairLegacyLayout
                />
              </div>
            </PreviewFormProvider>
          </PreviewReusableBlockProvider>
        </PreviewCollectionProvider>
      </OBSiteRoot>
    </div>
  );
};

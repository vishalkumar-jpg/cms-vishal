import * as React from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, ExternalLink, Loader2, RotateCw } from "lucide-react";
import type { SerializedLayout } from "@ob-cms/block-schema";
import {
  RenderLayout,
  blockRegistry,
  hydrateNavbarNodes,
  hydratePartnersLogoGrid,
  OBSiteRootBreakpointSources,
} from "@ob-cms/blocks";
import "@ob-cms/blocks/blocks.css";
import { Button } from "@/components/ui";
import { useSiteStore } from "@/store/siteStore";
import { usePage } from "@/views/pages/hooks/usePages";
import { usePreviewLayout } from "@/views/pages/hooks/usePreviewLayout";
import { PreviewReusableBlockProvider } from "./components/PreviewReusableBlockProvider";
import { PreviewFormProvider } from "./components/PreviewFormProvider";
import { PreviewCollectionProvider } from "./components/PreviewCollectionProvider";
import { useActiveSite } from "@/views/sites/hooks/useSites";
import { sitePageUrl } from "./lib/siteUrl";
import { useTheme } from "@/views/theme/hooks/useTheme";
import { themeTokensToCanvasVars } from "./craft/themeVars";
import { useBuilderPageNavigation } from "./hooks/useBuilderPageNavigation";
import {
  DEVICE_PRESETS,
  DeviceFrame,
  viewportFor,
  type Orientation,
} from "./components/DeviceFrame";

/**
 * Full-screen DRAFT preview (`/pages/:pageId/preview`). Renders the page's
 * unpublished `draftLayout` through the SAME `RenderLayout` + blocks the public
 * renderer uses, with `breakpointSource="container"` so breakpoint/viewport
 * follow measured `.ob-site` width (parity with Published).
 *
 * Device presets constrain CSS viewport width at 1:1 pixels (no transform scale).
 * The canvas scrolls when a framed device is larger than the pane.
 */
export const Preview: React.FC = () => {
  const { pageId = null } = useParams();
  const navigate = useNavigate();
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { activeSite } = useActiveSite();
  const { data: page, isLoading, isError } = usePage(siteId, pageId);
  const { layout: composedLayout, ready: composedReady } = usePreviewLayout(page, siteId);
  const { data: theme } = useTheme();

  const [deviceKey, setDeviceKey] = React.useState<string>("desktop");
  const [orientation, setOrientation] = React.useState<Orientation>("portrait");

  const preset =
    DEVICE_PRESETS.find((d) => d.key === deviceKey) ?? DEVICE_PRESETS[DEVICE_PRESETS.length - 1];

  const themeStyle = React.useMemo(
    () => themeTokensToCanvasVars(theme?.tokens),
    [theme?.tokens],
  );

  const layout = React.useMemo(() => {
    if (!composedLayout) return null;
    const hydratedNav = hydrateNavbarNodes(composedLayout.nodes as Record<string, unknown>);
    const baseNodes = hydratedNav.changed
      ? hydratedNav.nodes
      : (composedLayout.nodes as Record<string, unknown>);
    const hydratedPartners = hydratePartnersLogoGrid(baseNodes);
    const nodes = hydratedPartners.changed ? hydratedPartners.nodes : baseNodes;
    return (hydratedNav.changed || hydratedPartners.changed
      ? { ...composedLayout, nodes }
      : composedLayout) as SerializedLayout;
  }, [composedLayout]);

  const { width: vpWidth } = viewportFor(preset, orientation);
  const isDesktopPreset = vpWidth === 0;
  const { onLinkClickCapture } = useBuilderPageNavigation("preview");

  const publicUrl = page ? sitePageUrl(activeSite, page.slug) : null;

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      {/* Preview toolbar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/pages/${pageId}/builder`)}
            title="Back to editor"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="text-sm font-medium">{page?.title ?? "Preview"}</div>
            <div className="text-xs text-muted-foreground">Draft preview — not yet published</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Device picker */}
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            {DEVICE_PRESETS.map((d) => {
              const Icon = d.icon;
              const active = d.key === deviceKey;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    setDeviceKey(d.key);
                    setOrientation("portrait");
                  }}
                  title={d.label}
                  className={`flex h-8 items-center gap-1.5 rounded px-2 text-xs ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{d.label}</span>
                </button>
              );
            })}
          </div>

          {/* Orientation toggle (phones / tablets only) */}
          {preset.rotatable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setOrientation((o) => (o === "portrait" ? "landscape" : "portrait"))
              }
              title="Rotate"
            >
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
              {orientation === "portrait" ? "Portrait" : "Landscape"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {publicUrl && page?.status === "published" ? (
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View published
              </Button>
            </a>
          ) : null}
        </div>
      </div>

      {/* Canvas — full-bleed for desktop preset (parity with published site width) */}
      <div
        className={
          isDesktopPreset
            ? "flex flex-1 min-h-0 overflow-auto"
            : "flex flex-1 justify-center overflow-auto p-6"
        }
      >
        {isLoading || !composedReady ? (
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading preview…
          </div>
        ) : isError || !layout ? (
          <div className="flex items-center text-sm text-muted-foreground">
            Nothing to preview yet — add some blocks in the editor.
          </div>
        ) : (
          <div className={isDesktopPreset ? "w-full min-h-full" : "h-fit"}>
            <DeviceFrame preset={preset} orientation={orientation}>
              <PreviewCollectionProvider>
                <PreviewReusableBlockProvider>
                  <PreviewFormProvider>
                    <div style={themeStyle} onClickCapture={onLinkClickCapture}>
                      <RenderLayout
                        data={layout}
                        blocks={blockRegistry}
                        repairLegacyLayout
                        breakpointSource={OBSiteRootBreakpointSources.container}
                      />
                    </div>
                  </PreviewFormProvider>
                </PreviewReusableBlockProvider>
              </PreviewCollectionProvider>
            </DeviceFrame>
          </div>
        )}
      </div>
    </div>
  );
};

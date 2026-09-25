"use client";

import * as React from "react";
import {
  resolveStyleBreakpointFromContainerWidth,
  resolveViewportModeFromContainerWidth,
  resolveAuthoredStyleBreakpointFromContainer,
  type StyleBreakpoint,
  type ContainerStyleBreakpoint,
} from "@ob-cms/block-schema";
import { cx } from "./lib";
import { OBViewportProvider, type OBViewportMode } from "./viewport-context";
import { OBStyleBreakpointProvider } from "./style-breakpoint-context";
import {
  OBSiteRootBreakpointSources,
  type OBSiteRootBreakpointSource,
} from "./site-root-breakpoint-sources";

/**
 * OBSiteRoot — the wrapper that establishes the `.ob-site cms-site` container.
 *
 * The block CSS (`@ob-cms/blocks/blocks.css`) is scoped to `.ob-site` and uses
 * CSS container queries (`container-name: ob`) for the responsive lock. Every
 * rendered page MUST sit inside this wrapper for the responsive system, font
 * stack and design tokens to apply. `RenderLayout` wraps its output in this by
 * default (opt out with `wrap={false}` if the host already provides `.ob-site`,
 * e.g. the Craft.js editor canvas).
 *
 * Published pages opt in to container-width breakpoint detection via
 * `breakpointSource="container"`. Builder / draft preview pass explicit
 * `breakpoint` + `viewportMode` instead.
 */
export interface OBSiteRootProps {
  children?: React.ReactNode;
  className?: string;
  /** Render element tag (default "div"). */
  as?: keyof React.JSX.IntrinsicElements;
  /** Builder preview device mode — mirrors container-query breakpoints via data-ob-viewport. */
  viewportMode?: OBViewportMode;
  /** Active builder preview breakpoint (largeDesktop | laptop | tablet | mobile | desktop). */
  breakpoint?: string;
  /**
   * When `"container"`, measure `.ob-site` width and map to breakpoint/viewport
   * (published renderer only). Ignored when explicit `breakpoint` / `viewportMode`
   * are set. Omit on builder, preview, and other hosts to preserve legacy behavior.
   */
  breakpointSource?: OBSiteRootBreakpointSource;
  /** When true, mobile carousel autoplay is disabled (builder canvas). */
  "data-ob-builder-canvas"?: string;
}

const DESKTOP_CONTAINER_DEFAULT = {
  breakpoint: "desktop" as StyleBreakpoint,
  viewportMode: "desktop" as OBViewportMode,
  width: undefined as number | undefined,
};

export const OBSiteRoot: React.FC<OBSiteRootProps> = ({
  children,
  className,
  viewportMode,
  breakpoint,
  breakpointSource,
  as: rootTag = "div",
  "data-ob-builder-canvas": builderCanvas,
}) => {
  const rootRef = React.useRef<HTMLElement>(null);
  const useContainerDetection =
    breakpointSource === OBSiteRootBreakpointSources.container &&
    breakpoint == null &&
    viewportMode == null;
  const [detected, setDetected] = React.useState(DESKTOP_CONTAINER_DEFAULT);

  React.useLayoutEffect(() => {
    if (!useContainerDetection) return;
    const el = rootRef.current;
    if (!el) return;

    const update = (width: number) => {
      setDetected((prev) => {
        const next = {
          breakpoint: resolveStyleBreakpointFromContainerWidth(width),
          viewportMode: resolveViewportModeFromContainerWidth(width),
          width,
        };
        if (
          prev.breakpoint === next.breakpoint &&
          prev.viewportMode === next.viewportMode &&
          prev.width === next.width
        ) {
          return prev;
        }
        return next;
      });
    };

    update(el.getBoundingClientRect().width);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      update(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [useContainerDetection]);

  const containerBreakpoint = useContainerDetection ? detected.breakpoint : undefined;
  const effectiveBreakpoint =
    breakpoint ?? containerBreakpoint;
  const effectiveViewport =
    viewportMode ?? (useContainerDetection ? detected.viewportMode : undefined);
  const styleResolutionBreakpoint: StyleBreakpoint | undefined = useContainerDetection
    ? resolveAuthoredStyleBreakpointFromContainer(
        detected.width,
        detected.breakpoint as ContainerStyleBreakpoint,
      )
    : (effectiveBreakpoint as StyleBreakpoint | undefined);

  const rootProps = {
    ref: rootRef,
    className: cx("ob-site", "cms-site", className),
    ...(effectiveViewport ? { "data-ob-viewport": effectiveViewport } : {}),
    ...(effectiveBreakpoint ? { "data-ob-breakpoint": effectiveBreakpoint } : {}),
    ...(builderCanvas ? { "data-ob-builder-canvas": builderCanvas } : {}),
  };

  return (
    <OBViewportProvider value={effectiveViewport}>
      <OBStyleBreakpointProvider value={styleResolutionBreakpoint}>
        {React.createElement(rootTag, rootProps, children)}
      </OBStyleBreakpointProvider>
    </OBViewportProvider>
  );
};

import * as React from "react";
import { Smartphone, Tablet, Laptop, Monitor } from "lucide-react";
import { RESP_MOBILE_W, RESP_TABLET_W } from "@ob-cms/block-schema";
import { viewportModeForBreakpoint } from "../store/editorUiStore";
import type { Breakpoint } from "../property/styleTokens";

/** Canonical mobile/tablet CSS widths — match responsive container breakpoints. */
export const PREVIEW_MOBILE_VIEWPORT_W = RESP_MOBILE_W;
export const PREVIEW_TABLET_VIEWPORT_W = RESP_TABLET_W;

/**
 * Device presets for draft preview. `width`/`height` are the CSS viewport
 * (portrait) dimensions — the frame constrains the rendered page to this width
 * so per-breakpoint + container-query responsive styles match the published
 * renderer. Widths align with `@ob-cms/block-schema` container breakpoints
 * (390 mobile, 768 tablet) rather than physical device marketing sizes.
 * `Desktop` is a full-bleed (no fixed width / no bezel) sentinel.
 */
export interface DevicePreset {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** CSS width in portrait (px). 0 = full-bleed desktop. */
  width: number;
  /** CSS height in portrait (px). 0 = auto/full. */
  height: number;
  /** Whether orientation toggle applies (phones/tablets). */
  rotatable: boolean;
  /** Bezel thickness in px (0 = no chrome). */
  bezel: number;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  {
    key: "iphone15",
    label: "iPhone 15",
    icon: Smartphone,
    width: PREVIEW_MOBILE_VIEWPORT_W,
    height: 844,
    rotatable: true,
    bezel: 12,
  },
  {
    key: "pixel8",
    label: "Pixel 8",
    icon: Smartphone,
    width: PREVIEW_MOBILE_VIEWPORT_W,
    height: 915,
    rotatable: true,
    bezel: 12,
  },
  {
    key: "ipad",
    label: "iPad",
    icon: Tablet,
    width: PREVIEW_TABLET_VIEWPORT_W,
    height: 1024,
    rotatable: true,
    bezel: 16,
  },
  { key: "laptop", label: '13" Laptop', icon: Laptop, width: 1280, height: 800, rotatable: false, bezel: 14 },
  { key: "desktop", label: "Desktop", icon: Monitor, width: 0, height: 0, rotatable: false, bezel: 0 },
];

export type Orientation = "portrait" | "landscape";

/** Maps preview device preset → StyleModel breakpoint key for data-ob-breakpoint. */
export const breakpointForPreset = (preset: DevicePreset): Breakpoint => {
  if (preset.key === "iphone15" || preset.key === "pixel8") return "mobile";
  if (preset.key === "ipad") return "tablet";
  if (preset.key === "laptop") return "laptop";
  return "desktop";
};

/** Maps preview device preset → responsive viewport bucket for data-ob-viewport. */
export const viewportModeFor = (preset: DevicePreset) =>
  viewportModeForBreakpoint(breakpointForPreset(preset));

/** Resolved CSS viewport for a preset + orientation. */
export const viewportFor = (
  preset: DevicePreset,
  orientation: Orientation,
): { width: number; height: number } => {
  if (preset.width === 0) return { width: 0, height: 0 };
  const landscape = preset.rotatable && orientation === "landscape";
  return landscape
    ? { width: preset.height, height: preset.width }
    : { width: preset.width, height: preset.height };
};

/**
 * Wraps children in a subtle device bezel and constrains them to the device
 * viewport width (so responsive styles apply at 1:1 CSS pixels — no transform
 * scale). The admin canvas scrolls when a preset is taller/wider than the pane.
 * Desktop (width 0) renders full-bleed with no bezel.
 */
export const DeviceFrame: React.FC<{
  preset: DevicePreset;
  orientation: Orientation;
  children: React.ReactNode;
}> = ({ preset, orientation, children }) => {
  const { width, height } = viewportFor(preset, orientation);

  // Desktop / full-bleed: no bezel, page fills available width.
  if (width === 0) {
    return (
      <div className="h-fit min-h-full w-full bg-white shadow-sm">{children}</div>
    );
  }

  return (
    <div
      className="rounded-[2.25rem] bg-neutral-800 shadow-xl"
      style={{ padding: preset.bezel }}
      data-device-frame
    >
      <div
        className="overflow-hidden rounded-[1.5rem] bg-white"
        style={{ width, height }}
      >
        {/* Scroll the page inside the fixed-height device screen. */}
        <div className="h-full w-full overflow-auto" style={{ width }}>
          {children}
        </div>
      </div>
    </div>
  );
};

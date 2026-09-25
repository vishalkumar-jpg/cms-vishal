import * as React from "react";
import { StyleControls } from "./StyleControls";
import type { Breakpoint } from "./styleTokens";

interface LayoutControlsProps {
  nodeId: string;
  styles: Record<string, unknown>;
  breakpoint: Breakpoint;
  rootPath?: string;
}

/** Spacing, flex/grid arrangement, sizing, and positioning — separate from visual style. */
export const LayoutControls: React.FC<LayoutControlsProps> = (props) => (
  <StyleControls {...props} sections="layout" />
);

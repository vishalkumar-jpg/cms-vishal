import * as React from "react";
import type { ComponentProp, ComponentVariant } from "@ob-cms/block-schema";

/**
 * COMPONENTS — component-authoring context for the shared builder.
 *
 * The reusable-block (component) editor mounts the SAME <PropertyPanel> as the
 * page builder. When this context is present we're editing a COMPONENT SOURCE,
 * so the panel additionally offers:
 *   - a Props panel (declare typed props + defaults),
 *   - a "⚙ use prop" picker per node prop (write a `componentBinding`),
 *   - a "mark as Slot" toggle per node,
 *   - a Variants editor (named prop-presets).
 *
 * The page builder does NOT provide this context (`useComponentEditor()` returns
 * null), so none of the component-authoring affordances appear there — the panel
 * behaves exactly as before for ordinary pages (backward-compatible).
 */
export interface ComponentEditorContextValue {
  /** The component's declared props (the source of "⚙ use prop" picker options). */
  props: ComponentProp[];
  setProps: (next: ComponentProp[]) => void;
  /** The component's named variants (prop-presets). */
  variants: ComponentVariant[];
  setVariants: (next: ComponentVariant[]) => void;
}

export const ComponentEditorContext =
  React.createContext<ComponentEditorContextValue | null>(null);

export const useComponentEditor = (): ComponentEditorContextValue | null =>
  React.useContext(ComponentEditorContext);

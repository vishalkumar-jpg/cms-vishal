"use client";

import * as React from "react";
import {
  applyBindings,
  resolveBinding,
  type Bindings,
} from "@ob-cms/block-schema";

/**
 * RepeaterItemContext — carries the CURRENT repeater item's `data` (a field-key
 * keyed record) + its index so that descendant blocks can resolve bound props
 * against it. The Repeater block provides it once per item (renderer) or once
 * with a sample item (editor preview). SSR-safe: it's a plain React context with
 * a `null` default, so blocks outside a repeater behave exactly as before.
 */
export interface RepeaterItem {
  /** The item's field data (collection field-key → value). */
  data: Record<string, unknown>;
  /** Zero-based index within the repeated set. */
  index: number;
  /** Total number of items being repeated (for affordances / nth styling). */
  count: number;
  /** The item's stable id/slug, when available. */
  id?: string;
  slug?: string;
}

export const RepeaterItemContext = React.createContext<RepeaterItem | null>(null);

export const useRepeaterItem = (): RepeaterItem | null =>
  React.useContext(RepeaterItemContext);

/**
 * NodeBindingContext — carries the CURRENT node's `bindings` so a block's
 * `useBoundProp` can read its own bindings without threading a prop through.
 * Provided by the EDITOR wrapper (`createCraftBlock`) per node — the editor
 * renders shared blocks directly, so they must self-resolve. The renderer
 * instead PRE-resolves bound props in `renderNode` (`applyBindings`) and does
 * NOT provide this context, so `useBoundProp` there is a pass-through (the value
 * is already resolved). Either way resolution is idempotent.
 */
export const NodeBindingContext = React.createContext<Bindings | null>(null);

/**
 * Resolve a single block prop, honouring any binding on the current node and the
 * current repeater item. Outside a repeater (or with no binding) it returns the
 * static value unchanged — backward-compatible. This is the small resolver the
 * common content blocks call for their primary text/image/url props.
 */
export const useBoundProp = <T,>(propPath: string, staticValue: T): T => {
  const bindings = React.useContext(NodeBindingContext);
  const item = React.useContext(RepeaterItemContext);
  return resolveBinding(staticValue, propPath, bindings ?? undefined, item?.data) as T;
};

/**
 * Resolve EVERY bound prop on the current node at once — used by the shared
 * render path before instantiating a block component, so even blocks that don't
 * call `useBoundProp` get their bound props resolved. Pure pass-through when
 * there are no bindings / no item.
 */
export const useBoundProps = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const bindings = React.useContext(NodeBindingContext);
  const item = React.useContext(RepeaterItemContext);
  return applyBindings(props, bindings ?? undefined, item?.data);
};

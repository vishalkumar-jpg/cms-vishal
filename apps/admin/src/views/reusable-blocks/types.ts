import type {
  ComponentProp,
  ComponentVariant,
  SerializedLayout,
} from "@ob-cms/block-schema";

/**
 * A reusable / global synced block (REUSE-BLOCKS) — a named, per-site fragment
 * referenced (not copied) by `ReusableBlock` blocks on pages. Editing the source
 * updates EVERY instance. COMPONENTS: it may also declare editable `props` +
 * named `variants`; slot markers + componentBindings live inside `layout`.
 */
export interface ReusableBlock {
  id: string;
  name: string;
  /** A self-contained SerializedLayout (own root) for the saved fragment. */
  layout: SerializedLayout;
  /** COMPONENTS: declared editable props ([] for a plain reusable block). */
  props?: ComponentProp[];
  /** COMPONENTS: named prop-preset variants ([] for a plain reusable block). */
  variants?: ComponentVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateReusableBlockPayload {
  name: string;
  layout: SerializedLayout;
  props?: ComponentProp[];
  variants?: ComponentVariant[];
}

export interface UpdateReusableBlockPayload {
  name?: string;
  layout?: SerializedLayout;
  props?: ComponentProp[];
  variants?: ComponentVariant[];
}

import { useCallback } from "react";
import { useEditor } from "@craftjs/core";
import type { Bindings, VisibleIf, NodeExperiment } from "@ob-cms/block-schema";
import { useCollectionDetailBuilderContext } from "@/views/builder/collection-detail/CollectionDetailBuilderContext";
import { useCollections } from "@/views/collections/hooks/useCollections";
import type { CollectionField } from "@/views/collections/types";
import { resolveBindableFields } from "./resolveBindableFields";

/**
 * Data-binding node helpers (admin). A node's `bindings` (prop→field) and
 * `visibleIf` (visibility condition) live in Craft `custom` — the only arbitrary
 * node field Craft serializes — and are hoisted to top-level `bindings`/
 * `visibleIf` on save (see craft/serialize.ts). These hooks read + write that
 * `custom` bag via Craft's `setCustom`, and resolve bindable field keys from
 * the Collection Detail Builder context (layout root) or, when absent, from the
 * nearest ancestor Repeater's collection.
 */

interface CustomBag {
  bindings?: Bindings;
  visibleIf?: VisibleIf;
  experiment?: NodeExperiment;
}

/** Read the current node's bindings + visibleIf from its Craft `custom`. */
export const useNodeDynamic = (nodeId: string | null): CustomBag => {
  const { custom } = useEditor((state) => ({
    custom: (nodeId ? (state.nodes[nodeId]?.data.custom as CustomBag | undefined) : undefined) ?? {},
  }));
  return custom;
};

/** Set the bindings map on a node (writes to Craft `custom.bindings`). */
export const useSetBindings = (nodeId: string | null) => {
  const { actions } = useEditor();
  return useCallback(
    (next: Bindings) => {
      if (!nodeId) return;
      actions.setCustom(nodeId, (custom: CustomBag) => {
        if (Object.keys(next).length === 0) delete custom.bindings;
        else custom.bindings = next;
      });
    },
    [nodeId, actions],
  );
};

/** Set (or clear) the visibility condition on a node (Craft `custom.visibleIf`). */
export const useSetVisibleIf = (nodeId: string | null) => {
  const { actions } = useEditor();
  return useCallback(
    (next: VisibleIf | undefined) => {
      if (!nodeId) return;
      actions.setCustom(nodeId, (custom: CustomBag) => {
        if (!next || next.type === "always") delete custom.visibleIf;
        else custom.visibleIf = next;
      });
    },
    [nodeId, actions],
  );
};

/**
 * Set (or clear) the A/B experiment mapping on an Experiment node (Craft
 * `custom.experiment`, hoisted to top-level `node.experiment` on save). The
 * mapping is `{ experimentId, variantKeys }` where `variantKeys[i]` is the key
 * for the node's i-th child subtree.
 */
export const useSetExperiment = (nodeId: string | null) => {
  const { actions } = useEditor();
  return useCallback(
    (next: NodeExperiment | undefined) => {
      if (!nodeId) return;
      actions.setCustom(nodeId, (custom: CustomBag) => {
        if (!next || (!next.experimentId && (next.variantKeys ?? []).length === 0))
          delete custom.experiment;
        else custom.experiment = next;
      });
    },
    [nodeId, actions],
  );
};

/**
 * The direct child node ids of a canvas node (its variant subtrees for an
 * Experiment). Used by the Experiment authoring panel to label each subtree with
 * a variant key.
 */
export const useChildNodeIds = (nodeId: string | null): string[] => {
  const { childIds } = useEditor((state) => ({
    childIds: nodeId ? (state.nodes[nodeId]?.data.nodes ?? []) : [],
  }));
  return childIds;
};

/**
 * Resolve the `collectionSlug` of the nearest ANCESTOR Repeater of `nodeId` (so
 * a bound prop / field condition knows which collection's fields it may use).
 * Returns null when the node isn't inside a Repeater.
 */
export const useAncestorRepeaterSlug = (nodeId: string | null): string | null => {
  const { slug } = useEditor((state) => {
    let cursor: string | null = nodeId;
    let found: string | null = null;
    // Walk up the parent chain to the first Repeater.
    for (let i = 0; i < 64; i += 1) {
      if (!cursor) break;
      const node = state.nodes[cursor];
      if (!node) break;
      if (node.data.displayName === "Repeater" || node.data.name === "Repeater") {
        found = (node.data.props as { collectionSlug?: string }).collectionSlug ?? null;
        break;
      }
      cursor = node.data.parent ?? null;
    }
    return { slug: found };
  });
  return slug;
};

/**
 * The collection field keys a node may bind to. When the Collection Detail
 * Builder context is active, returns that collection's fields (layout root).
 * Otherwise falls back to the ancestor Repeater's collection. Empty when neither
 * applies (or the Repeater has no collection selected yet).
 */
export const useBindableFields = (nodeId: string | null): CollectionField[] => {
  const detailContext = useCollectionDetailBuilderContext();
  const slug = useAncestorRepeaterSlug(nodeId);
  const { data: collections = [] } = useCollections({ enabled: !detailContext });
  return resolveBindableFields(detailContext, slug, collections);
};

export const useIsInRepeater = (nodeId: string | null): boolean =>
  useAncestorRepeaterSlug(nodeId) !== null;

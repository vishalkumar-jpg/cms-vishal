import { useCallback } from "react";
import { useEditor } from "@craftjs/core";
import type { ComponentBinding } from "@ob-cms/block-schema";

/**
 * COMPONENTS — node-authoring helpers for the component (reusable-block) editor.
 *
 * Like data-binding's `useNodeBinding`, the per-node component fields
 * (`componentBinding`, `isSlot`, `slotName`) live in Craft `custom` (the only
 * arbitrary node field Craft serializes) and are hoisted to top-level on save
 * (see craft/serialize.ts). These hooks read + write that `custom` bag via
 * Craft's `setCustom`.
 */

interface ComponentCustomBag {
  componentBinding?: ComponentBinding;
  isSlot?: boolean;
  slotName?: string;
}

/** Read the selected node's component-authoring fields from its Craft `custom`. */
export const useNodeComponent = (nodeId: string | null): ComponentCustomBag => {
  const { custom } = useEditor((state) => ({
    custom:
      (nodeId ? (state.nodes[nodeId]?.data.custom as ComponentCustomBag | undefined) : undefined) ??
      {},
  }));
  return custom;
};

/** Set (or clear) the node's `componentBinding` map (Craft `custom`). */
export const useSetComponentBinding = (nodeId: string | null) => {
  const { actions } = useEditor();
  return useCallback(
    (next: ComponentBinding) => {
      if (!nodeId) return;
      actions.setCustom(nodeId, (custom: ComponentCustomBag) => {
        if (Object.keys(next).length === 0) delete custom.componentBinding;
        else custom.componentBinding = next;
      });
    },
    [nodeId, actions],
  );
};

/** Mark (or unmark) the node as a named Slot (Craft `custom`). */
export const useSetSlot = (nodeId: string | null) => {
  const { actions } = useEditor();
  return useCallback(
    (slotName: string | undefined) => {
      if (!nodeId) return;
      actions.setCustom(nodeId, (custom: ComponentCustomBag) => {
        if (!slotName) {
          delete custom.isSlot;
          delete custom.slotName;
        } else {
          custom.isSlot = true;
          custom.slotName = slotName;
        }
      });
    },
    [nodeId, actions],
  );
};

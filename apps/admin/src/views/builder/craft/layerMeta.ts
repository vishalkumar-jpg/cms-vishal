import { useCallback } from "react";
import { useEditor } from "@craftjs/core";

/**
 * Layers-panel node metadata — a custom rename label + an editor-side lock, both
 * stored on Craft `node.custom.layer` (like bindings/guardrails). `custom` is
 * preserved verbatim by the schema (`custom: z.record(z.unknown())`), so these
 * round-trip through save/load natively with no extra hoist.
 *
 *  - `name`   : a human rename shown in the Layers tree (falls back to the
 *               block's displayName when unset). Figma-style layer naming.
 *  - `locked` : an editor lock that stops the node being dragged / reordered /
 *               deleted from the canvas or the Layers panel (distinct from the
 *               role-gated brand `guardrails.locked`).
 */
export interface LayerMeta {
  name?: string;
  locked?: boolean;
  /** Optional folder label for layer organization. */
  folder?: string;
  /** Layer color label (hex or token). */
  colorLabel?: string;
}

interface LayerCustomBag extends Record<string, unknown> {
  layer?: LayerMeta;
}

/** Read the layer metadata off a node's `custom` bag (never throws). */
export const readLayerMeta = (custom: unknown): LayerMeta =>
  (custom as LayerCustomBag | undefined)?.layer ?? {};

/** Resolve the label shown for a node: custom name → displayName → name. */
export const resolveLayerName = (node: {
  data: { custom?: unknown; displayName?: string; name?: string };
}): string => {
  const custom = readLayerMeta(node.data.custom).name?.trim();
  return custom || node.data.displayName || node.data.name || "Block";
};

/** Whether a node carries the editor lock. */
export const isLayerLocked = (node: { data: { custom?: unknown } }): boolean =>
  readLayerMeta(node.data.custom).locked === true;

/** Writers for the layer metadata (rename + lock), backed by Craft `setCustom`. */
export const useLayerMeta = (): {
  setName: (id: string, name: string) => void;
  setLocked: (id: string, locked: boolean) => void;
  setColorLabel: (id: string, color: string | null) => void;
  setFolder: (id: string, folder: string | null) => void;
} => {
  const { actions } = useEditor();

  const setName = useCallback(
    (id: string, name: string) => {
      actions.setCustom(id, (custom: LayerCustomBag) => {
        const layer: LayerMeta = { ...(custom.layer ?? {}) };
        const trimmed = name.trim();
        if (trimmed) layer.name = trimmed;
        else delete layer.name;
        if (Object.keys(layer).length === 0) delete custom.layer;
        else custom.layer = layer;
      });
    },
    [actions],
  );

  const setLocked = useCallback(
    (id: string, locked: boolean) => {
      actions.setCustom(id, (custom: LayerCustomBag) => {
        const layer: LayerMeta = { ...(custom.layer ?? {}) };
        if (locked) layer.locked = true;
        else delete layer.locked;
        if (Object.keys(layer).length === 0) delete custom.layer;
        else custom.layer = layer;
      });
    },
    [actions],
  );

  const setColorLabel = useCallback(
    (id: string, color: string | null) => {
      actions.setCustom(id, (custom: LayerCustomBag) => {
        const layer: LayerMeta = { ...(custom.layer ?? {}) };
        if (color) layer.colorLabel = color;
        else delete layer.colorLabel;
        if (Object.keys(layer).length === 0) delete custom.layer;
        else custom.layer = layer;
      });
    },
    [actions],
  );

  const setFolder = useCallback(
    (id: string, folder: string | null) => {
      actions.setCustom(id, (custom: LayerCustomBag) => {
        const layer: LayerMeta = { ...(custom.layer ?? {}) };
        const trimmed = folder?.trim();
        if (trimmed) layer.folder = trimmed;
        else delete layer.folder;
        if (Object.keys(layer).length === 0) delete custom.layer;
        else custom.layer = layer;
      });
    },
    [actions],
  );

  return { setName, setLocked, setColorLabel, setFolder };
};

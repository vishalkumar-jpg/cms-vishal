import { useCallback } from "react";
import { useEditor } from "@craftjs/core";
import { hasRoleAtLeast } from "@ob-cms/shared";
import { useActiveRole } from "@/hooks/useActiveRole";

/**
 * Brand guardrails — per-node locks + constraints, stored on Craft `node.custom`
 * (hoisted on serialize like bindings/components) so they round-trip and reach
 * the renderer/schema. The goal is on-brand safety for non-designers, not a full
 * permission engine.
 *
 *  - `locked`           : node can't be moved/deleted/duplicated/dragged.
 *  - `colorsTokenOnly`  : color controls only allow theme tokens (no raw hex).
 *  - `lockedProps`      : prop paths whose controls are disabled/hidden.
 *  - `editableProps`    : when set, ONLY these prop paths are editable (allowlist).
 *
 * Role-gating: a designer (site_admin+) defines locks/constraints and is never
 * constrained themselves; a contributor sees them enforced.
 */
export interface NodeGuardrails {
  locked?: boolean;
  colorsTokenOnly?: boolean;
  lockedProps?: string[];
  editableProps?: string[];
}

interface CustomBag extends Record<string, unknown> {
  guardrails?: NodeGuardrails;
}

/** Read a node's guardrails reactively. Returns `{}` when none/clear. */
export const useNodeGuardrails = (nodeId: string | null): NodeGuardrails => {
  const { guardrails } = useEditor((state) => ({
    guardrails: nodeId
      ? ((state.nodes[nodeId]?.data.custom as CustomBag | undefined)?.guardrails ?? {})
      : {},
  }));
  return guardrails;
};

/** Imperative read (no subscription) — used by action-layer gates. */
export const useReadGuardrails = (): ((nodeId: string) => NodeGuardrails) => {
  const { query } = useEditor();
  return useCallback(
    (nodeId: string): NodeGuardrails => {
      try {
        const custom = query.node(nodeId).get().data.custom as CustomBag | undefined;
        return custom?.guardrails ?? {};
      } catch {
        return {};
      }
    },
    [query],
  );
};

/** Writer for a node's guardrails (clears the key when fully empty). */
export const useSetGuardrails = (nodeId: string | null): ((next: NodeGuardrails) => void) => {
  const { actions } = useEditor();
  return useCallback(
    (next: NodeGuardrails) => {
      if (!nodeId) return;
      actions.setCustom(nodeId, (custom: CustomBag) => {
        const cleaned: NodeGuardrails = {};
        if (next.locked) cleaned.locked = true;
        if (next.colorsTokenOnly) cleaned.colorsTokenOnly = true;
        if (next.lockedProps && next.lockedProps.length > 0) cleaned.lockedProps = next.lockedProps;
        if (next.editableProps && next.editableProps.length > 0)
          cleaned.editableProps = next.editableProps;
        if (Object.keys(cleaned).length === 0) delete custom.guardrails;
        else custom.guardrails = cleaned;
      });
    },
    [nodeId, actions],
  );
};

/**
 * Whether the current user may DEFINE guardrails (designer/admin). Contributors
 * and editors get constraints enforced; site_admin+ can set them and bypass them.
 */
export const useCanDesign = (): boolean => {
  const role = useActiveRole();
  // No role resolved (e.g. local/dev with no membership) => treat as designer so
  // the affordance is usable; real contributors resolve to "contributor".
  if (role == null) return true;
  return hasRoleAtLeast(role, "site_admin");
};

/**
 * Whether constraints should be ENFORCED for the current user on a given node.
 * Designers bypass enforcement (they're defining the rules). Returns the
 * effective guardrails to apply (empty for designers).
 */
export const useEnforcedGuardrails = (nodeId: string | null): NodeGuardrails => {
  const guardrails = useNodeGuardrails(nodeId);
  const canDesign = useCanDesign();
  return canDesign ? {} : guardrails;
};

/** Is a specific prop path editable under the (enforced) guardrails? */
export const isPropEditable = (g: NodeGuardrails, path: string): boolean => {
  if (g.editableProps && g.editableProps.length > 0) {
    return g.editableProps.some((p) => path === p || path.startsWith(`${p}.`));
  }
  if (g.lockedProps && g.lockedProps.length > 0) {
    return !g.lockedProps.some((p) => path === p || path.startsWith(`${p}.`));
  }
  return true;
};

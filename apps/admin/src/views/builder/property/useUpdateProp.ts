import { useCallback } from "react";
import { useEditor } from "@craftjs/core";

/** Set a (possibly nested, dot-pathed) prop on a node via Craft's setProp. */
const setNested = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (typeof cursor[key] !== "object" || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
};

export const useUpdateProp = (nodeId: string | null) => {
  const { actions } = useEditor();
  return useCallback(
    (path: string, value: unknown) => {
      if (!nodeId) return;
      actions.setProp(nodeId, (props: Record<string, unknown>) => {
        setNested(props, path, value);
      });
    },
    [nodeId, actions],
  );
};

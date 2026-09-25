import type { BlockNode } from "../layout";
import type { NativeBlockPayload } from "./types";

export interface CreateNativeLeafBlockArgs {
  nodeId: string;
  parentId: string;
  payload: NativeBlockPayload;
  custom?: Record<string, unknown>;
}

export const createNativeLeafBlock = ({
  nodeId,
  parentId,
  payload,
  custom,
}: CreateNativeLeafBlockArgs): BlockNode => ({
  type: { resolvedName: payload.resolvedName },
  isCanvas: false,
  props: payload.props,
  displayName: payload.resolvedName,
  custom: custom ?? {},
  parent: parentId,
  hidden: false,
  nodes: [],
  linkedNodes: {},
});

import { blockPropSchemas } from "../block-props";
import type { NativeBlockPayload } from "./types";

/** Validates against canonical block schemas without mutating props. */
export const validateNativeBlockPayload = (
  payload: NativeBlockPayload,
): NativeBlockPayload | null => {
  if (!Object.hasOwn(blockPropSchemas, payload.resolvedName)) return null;
  const schema = blockPropSchemas[payload.resolvedName];
  const result = schema.safeParse(payload.props);
  if (!result.success) return null;
  return payload;
};

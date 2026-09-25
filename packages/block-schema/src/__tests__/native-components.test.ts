import { describe, expect, test } from "bun:test";
import { blockPropSchemas } from "../block-props";
import {
  createNativeLeafBlock,
  validateNativeBlockPayload,
  type NativeBlockPayload,
} from "../native-components";
import { HEADING_BLOCK, IMAGE_BLOCK } from "../resolved-block-names";

describe("native-components", () => {
  test("validateNativeBlockPayload accepts valid resolvedName and props", () => {
    const payload: NativeBlockPayload = {
      resolvedName: HEADING_BLOCK,
      props: { text: "Hello" },
    };
    expect(validateNativeBlockPayload(payload)).toEqual(payload);
  });

  test("validateNativeBlockPayload rejects unknown resolvedName", () => {
    expect(
      validateNativeBlockPayload({ resolvedName: "Not A Real Block", props: {} }),
    ).toBeNull();
  });

  test("validateNativeBlockPayload rejects inherited object keys without throwing", () => {
    expect(validateNativeBlockPayload({ resolvedName: "constructor", props: {} })).toBeNull();
    expect(validateNativeBlockPayload({ resolvedName: "toString", props: {} })).toBeNull();
  });

  test("validateNativeBlockPayload rejects invalid props", () => {
    expect(
      validateNativeBlockPayload({
        resolvedName: IMAGE_BLOCK,
        props: { imageUrl: 123 },
      }),
    ).toBeNull();
  });

  test("createNativeLeafBlock preserves node shape and relationships", () => {
    const payload: NativeBlockPayload = {
      resolvedName: HEADING_BLOCK,
      props: { text: "Title" },
    };
    const custom = { source: "test" };
    const before = JSON.stringify(payload);
    const node = createNativeLeafBlock({
      nodeId: "node-1",
      parentId: "parent-1",
      payload,
      custom,
    });
    expect(JSON.stringify(payload)).toBe(before);
    expect(node.type.resolvedName).toBe(HEADING_BLOCK);
    expect(node.props).toEqual({ text: "Title" });
    expect(node.parent).toBe("parent-1");
    expect(node.isCanvas).toBe(false);
    expect(node.nodes).toEqual([]);
    expect(node.linkedNodes).toEqual({});
    expect(node.custom).toEqual(custom);
    expect(blockPropSchemas[HEADING_BLOCK]?.safeParse(node.props).success).toBe(true);
  });
});

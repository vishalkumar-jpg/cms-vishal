import * as React from "react";
import { useNode, Element, type UserComponent } from "@craftjs/core";
import { blockRegistry } from "@ob-cms/blocks";
import { createCraftBlock, CanvasSlot } from "./createCraftBlock";

/**
 * The Craft resolver: `resolvedName` -> Craft UserComponent. Built once from the
 * shared @ob-cms/blocks registry so the editor and the renderer share one source
 * of visual truth. Serialized `type.resolvedName` values match the renderer's
 * registry keys exactly.
 */
const blockResolver: Record<string, UserComponent<Record<string, unknown>>> =
  Object.fromEntries(
    Object.entries(blockRegistry).map(([name, entry]) => [
      name,
      createCraftBlock(name, entry),
    ]),
  );

/**
 * Editor canvas root. A Craft canvas node that accepts any block. Serializes as
 * a plain container ("Root") — when loading an existing page we instead
 * deserialize the saved tree (whose root is a "Section").
 */
export const RootFrame: UserComponent<{ children?: React.ReactNode }> = ({ children }) => {
  const {
    connectors: { connect },
  } = useNode();
  const empty = React.Children.count(children) === 0;
  return (
    <div
      ref={(el) => {
        if (el) connect(el);
      }}
      className="min-h-full w-full"
      // Guarantee a tall, visible drop target even when the canvas is empty
      // (a fresh page or an unset global header/footer), so the first block
      // has somewhere to land.
      style={{ minHeight: "60vh" }}
    >
      {empty ? (
        <div
          className="flex h-[60vh] w-full items-center justify-center text-sm text-muted-foreground"
          style={{ border: "2px dashed hsl(var(--border))", borderRadius: 8, margin: 8 }}
        >
          Drag blocks here to start building.
        </div>
      ) : (
        children
      )}
    </div>
  );
};
RootFrame.craft = {
  displayName: "Root",
  rules: { canMoveIn: () => true },
};

export const resolver = {
  ...blockResolver,
  RootFrame,
  // CanvasSlot is referenced inside canvas blocks via <Element is={CanvasSlot}>;
  // it must be resolvable by name for nested canvas regions to (de)serialize.
  CanvasSlot,
};

export { Element };
export type CraftResolver = typeof resolver;

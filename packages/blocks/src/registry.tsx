import * as React from "react";
import { blockPropSchemas, type SerializedLayout } from "@ob-cms/block-schema";
import { OB_NAV_ITEMS, OB_STAFFING_MEGA_COLUMNS } from "./ob-nav-data";
import { blockComponents as components } from "./block-components";
import "./block-components-register";

/**
 * The shared block registry — the SAME pure React components used by the admin
 * builder canvas (Craft.js, Wave 2) AND the Next.js renderer (Wave 3). One
 * source of visual truth, no drift (TECH-ARCHITECTURE §1). Keys are the Craft.js
 * `type.resolvedName` values from the OB export and MUST match
 * @ob-cms/block-schema's `blockPropSchemas`.
 */

/**
 * A renderable block. Every block is now a `forwardRef` component so the
 * Craft.js builder can attach drag/select connectors to the block's real root
 * DOM node. The renderer consumes it WITHOUT passing a ref (forwardRef
 * components render fine with no ref); the admin passes a ref via the connector.
 * Typed as a permissive component so both usages (ref / no-ref) type-check and
 * the registry can hold heterogeneous prop shapes.
 */
export type BlockComponent =
  | React.FC<any>
  | React.ForwardRefExoticComponent<any>;

/** Craft.js metadata Wave 2 can attach to each component (kept as plain data so
 *  the components themselves stay Craft-agnostic). */
export interface BlockCraftMeta {
  displayName: string;
  isCanvas: boolean;
  defaultProps: Record<string, unknown>;
}

/** The zod schema type (referenced indirectly to avoid a direct zod import). */
export type BlockPropSchema = (typeof blockPropSchemas)[string];

export interface BlockRegistryEntry {
  component: BlockComponent;
  propSchema: BlockPropSchema;
  isCanvas: boolean;
  defaultProps: Record<string, unknown>;
  craft: BlockCraftMeta;
}

const CANVAS_TYPES = new Set([
  "Section", "Container", "Row", "Column", "Grid", "Slider", "Card", "Group", "Modal", "Div", "Footer", "Footer Columns",
  "Design Frame",
  "Navbar",
  "NavMenu",
  // Repeater is a canvas block: its children form the per-item template subtree.
  "Repeater",
  // Experiment is a canvas block: its children are the per-variant subtrees.
  "Experiment",
]);

const buildEntry = (name: string, component: BlockComponent): BlockRegistryEntry => {
  const propSchema = blockPropSchemas[name];
  const isCanvas = CANVAS_TYPES.has(name);
  // Default props = the schema's parsed empty object (fills defaults).
  const parsed = propSchema?.safeParse({});
  const defaultProps = parsed && parsed.success ? (parsed.data as Record<string, unknown>) : {};
  if (name === "Navbar") {
    // New palette inserts start in composed mode; saved pages with `navItems` use legacy.
    defaultProps.mode = "composed";
  }
  if (name === "Nav Mega") {
    defaultProps.label = "Staffing Services";
    defaultProps.columns = OB_STAFFING_MEGA_COLUMNS;
  }
  if (name === "Nav Dropdown") {
    defaultProps.label = "Solutions";
    defaultProps.items = OB_NAV_ITEMS[0]?.items ?? [];
  }
  return {
    component,
    propSchema,
    isCanvas,
    defaultProps,
    craft: { displayName: name, isCanvas, defaultProps },
  };
};

function buildBlockRegistry(): Record<string, BlockRegistryEntry> {
  return Object.fromEntries(
    Object.entries(components).map(
      ([name, comp]): [string, BlockRegistryEntry] => [name, buildEntry(name, comp)],
    ),
  );
}

let registryCache: Record<string, BlockRegistryEntry> | undefined;

export function getBlockRegistry(): Record<string, BlockRegistryEntry> {
  if (!registryCache) {
    registryCache = buildBlockRegistry();
  }
  return registryCache;
}

/** Full registry: resolvedName -> { component, propSchema, isCanvas, defaultProps, craft }. */
export const blockRegistry: Record<string, BlockRegistryEntry> = new Proxy(
  {} as Record<string, BlockRegistryEntry>,
  {
    get(_target, prop, receiver) {
      if (prop === "then") return undefined;
      const reg = getBlockRegistry();
      if (typeof prop === "string" && prop in reg) return reg[prop];
      return Reflect.get(reg, prop, receiver);
    },
    ownKeys() {
      return Reflect.ownKeys(getBlockRegistry());
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(getBlockRegistry(), prop);
    },
    has(_target, prop) {
      return prop in getBlockRegistry();
    },
  },
);

export { blockComponents } from "./block-components";

/** All registered block type names (lazy — safe during circular module init). */
const registeredBlockTypeKeys = (): string[] => Object.keys(getBlockRegistry());

export const REGISTERED_BLOCK_TYPES: readonly string[] = new Proxy([] as string[], {
  get(_target, prop, receiver) {
    const keys = registeredBlockTypeKeys();
    if (prop === "length") return keys.length;
    if (prop === Symbol.iterator) return keys[Symbol.iterator]!.bind(keys);
    if (typeof prop === "string" && /^\d+$/.test(prop)) return keys[Number(prop)];
    const method = (Array.prototype as unknown as Record<string, unknown>)[prop as string];
    if (typeof method === "function") return (method as (...args: unknown[]) => unknown).bind(keys);
    return Reflect.get(keys, prop, receiver);
  },
  ownKeys() {
    const keys = registeredBlockTypeKeys();
    return ["length", ...keys.map((_, index) => String(index))];
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (prop === "length") {
      return {
        value: registeredBlockTypeKeys().length,
        writable: true,
        enumerable: false,
        configurable: false,
      };
    }
    const keys = registeredBlockTypeKeys();
    if (typeof prop === "string" && /^\d+$/.test(prop)) {
      const index = Number(prop);
      if (index >= 0 && index < keys.length) {
        return {
          value: keys[index],
          writable: true,
          enumerable: true,
          configurable: true,
        };
      }
    }
    return undefined;
  },
  has(_target, prop) {
    if (prop === "length") return true;
    const keys = registeredBlockTypeKeys();
    if (typeof prop === "string" && /^\d+$/.test(prop)) {
      const index = Number(prop);
      return index >= 0 && index < keys.length;
    }
    return false;
  },
});

export type { SerializedLayout };

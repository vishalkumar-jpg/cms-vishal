import { z } from "zod";
import { blockPropSchemas, BLOCK_TYPES } from "@ob-cms/block-schema";

/**
 * Schema-grounding: derive a compact, LLM-readable catalog of all 28 registered
 * blocks straight from `blockPropSchemas` (the single source of truth). We never
 * hand-maintain a parallel list — if a block is added/removed in
 * @ob-cms/block-schema, this catalog tracks it automatically.
 *
 * For each block we surface its `type.resolvedName`, whether it is a canvas
 * (can hold children), and a compact `prop: type` map introspected from the zod
 * shape. `styles` is omitted from per-block prop lists (every block carries it)
 * and documented once in the system prompt.
 */

// The 8 canvas/layout primitives that may contain child nodes.
const CANVAS_BLOCKS = new Set<string>([
  "Section",
  "Container",
  "Row",
  "Column",
  "Grid",
  "Div",
  "Footer",
  "Footer Columns",
]);

/** Best-effort one-word type label for a zod field (for the prompt only). */
function describeField(schema: z.ZodTypeAny): string {
  let s: z.ZodTypeAny = schema;
  // Unwrap optional/default/nullable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (x: z.ZodTypeAny): any => (x as unknown as { _def: any })._def;
  let guard = 0;
  while (guard < 10) {
    const typeName = def(s)?.typeName as string | undefined;
    if (typeName === "ZodOptional" || typeName === "ZodNullable" || typeName === "ZodDefault") {
      s = def(s).innerType ?? def(s).schema ?? s;
      guard++;
      continue;
    }
    break;
  }
  const typeName = def(s)?.typeName as string | undefined;
  switch (typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodArray":
      return "array";
    case "ZodObject":
      return "object";
    case "ZodRecord":
      return "object";
    case "ZodUnion":
      return "string|number";
    default:
      return "any";
  }
}

export interface BlockCatalogEntry {
  type: string;
  isCanvas: boolean;
  props: Record<string, string>;
}

/** Build the catalog of every registered block from the live zod schemas. */
export function buildBlockCatalog(): BlockCatalogEntry[] {
  return BLOCK_TYPES.map((type) => {
    const schema = blockPropSchemas[type];
    const props: Record<string, string> = {};
    // ZodObject.shape is a getter in zod 3.x; guard defensively.
    const shape =
      schema instanceof z.ZodObject
        ? (schema.shape as Record<string, z.ZodTypeAny>)
        : {};
    for (const [key, field] of Object.entries(shape)) {
      if (key === "styles") continue; // documented once, globally
      props[key] = describeField(field);
    }
    return { type, isCanvas: CANVAS_BLOCKS.has(type), props };
  });
}

/** Render the catalog as a compact text block for the system prompt. */
export function renderCatalogForPrompt(): string {
  const catalog = buildBlockCatalog();
  return catalog
    .map((b) => {
      const propList = Object.entries(b.props)
        .map(([k, t]) => `${k}:${t}`)
        .join(", ");
      const flag = b.isCanvas ? " [CANVAS — may have child nodes]" : "";
      return `- "${b.type}"${flag} props: { ${propList} }`;
    })
    .join("\n");
}

/** The set of valid block type names (for hard validation of emitted nodes). */
export function validBlockTypes(): Set<string> {
  return new Set(BLOCK_TYPES);
}

import {
  migrate,
  repairLayout,
  sanitizeText,
  sanitizeUrl,
  validateBlockProps,
  type BlockNode,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import { validBlockTypes } from "./block-catalog";

const MAX_OUTPUT_BYTES = 200_000; // guardrail: cap emitted layout size
const TEXT_PROPS = new Set(["title", "subtitle", "text", "label", "highlightText", "altText"]);
const URL_PROPS = new Set(["url", "ctaUrl", "imageUrl", "href", "linkUrl", "rightUrl", "trustBadgeLink"]);

export interface LayoutValidation {
  ok: boolean;
  layout?: SerializedLayout;
  errors: string[];
}

/**
 * Parse + hard-validate the model's emitted JSON against the block registry,
 * then repair. Returns errors suitable for feeding back to the model on a
 * self-correction retry.
 *
 * Steps:
 *  1. Strip code fences / extract the JSON object; reject oversize output.
 *  2. JSON.parse.
 *  3. Collect HARD errors: unknown block types, missing ROOT, dangling child
 *     refs, per-block prop validation failures (validateBlockProps).
 *  4. If any node uses an unregistered type, that's a hard failure (we won't
 *     silently drop the model's intent — we ask it to fix).
 *  5. migrate() + repairLayout() to fill defaults / normalize, then sanitize
 *     user-facing text & URL props (defense-in-depth over the model output).
 */
export function validateAndRepair(raw: string): LayoutValidation {
  const errors: string[] = [];

  const extracted = extractJsonObject(raw);
  if (extracted == null) {
    return { ok: false, errors: ["Output is not a JSON object."] };
  }
  if (Buffer.byteLength(extracted, "utf8") > MAX_OUTPUT_BYTES) {
    return { ok: false, errors: [`Output exceeds the ${MAX_OUTPUT_BYTES}-byte size limit.`] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch (e) {
    return { ok: false, errors: [`Output is not valid JSON: ${(e as Error).message}`] };
  }

  const obj = parsed as { root?: unknown; nodes?: unknown };
  const nodes = obj?.nodes;
  if (typeof nodes !== "object" || nodes === null) {
    return { ok: false, errors: ['Missing "nodes" object.'] };
  }
  const nodeMap = nodes as Record<string, BlockNode>;
  if (!nodeMap.ROOT) {
    errors.push('No "ROOT" node found — the root must be a canvas Section with id "ROOT".');
  }

  const valid = validBlockTypes();
  for (const [id, node] of Object.entries(nodeMap)) {
    const type = node?.type?.resolvedName;
    if (!type) {
      errors.push(`Node "${id}" has no type.resolvedName.`);
      continue;
    }
    if (!valid.has(type)) {
      errors.push(`Node "${id}" uses unregistered block type "${type}". Use only registered blocks.`);
      continue;
    }
    const propsCheck = validateBlockProps(type, node.props ?? {});
    if (!propsCheck.ok) {
      errors.push(`Node "${id}" (${type}) has invalid props: ${propsCheck.error}`);
    }
    // Dangling child refs.
    for (const childId of node.nodes ?? []) {
      if (!nodeMap[childId]) {
        errors.push(`Node "${id}" references missing child "${childId}".`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Normalize + fill defaults + drop legacy aliases, then sanitize text/urls.
  const repaired = repairLayout(migrate(parsed));
  const sanitized = sanitizeLayout(repaired);
  return { ok: true, layout: sanitized, errors: [] };
}

/** Sanitize user-facing text and URL props across the layout (defense in depth). */
function sanitizeLayout(layout: SerializedLayout): SerializedLayout {
  const nodes: Record<string, BlockNode> = {};
  for (const [id, node] of Object.entries(layout.nodes)) {
    const props = { ...(node.props ?? {}) };
    for (const key of Object.keys(props)) {
      if (TEXT_PROPS.has(key) && typeof props[key] === "string") {
        props[key] = sanitizeText(props[key]);
      } else if (URL_PROPS.has(key) && typeof props[key] === "string") {
        props[key] = sanitizeUrl(props[key]);
      }
    }
    nodes[id] = { ...node, props };
  }
  return { ...layout, nodes };
}

/** Strip ```json fences and isolate the first {...} object. */
function extractJsonObject(raw: string): string | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return s.slice(start, end + 1);
}

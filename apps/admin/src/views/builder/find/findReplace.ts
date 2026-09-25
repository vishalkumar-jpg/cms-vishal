/**
 * Find & Replace traversal helpers (pure, client-only).
 *
 * Which text props are searched: the same user-visible text props inline editing
 * covers, plus link/button text and nav/link-item labels. The map is the source
 * of truth — keep it in sync with the inline-editable props.
 */

/** displayName → the string prop keys that hold searchable text. */
export const SEARCH_TEXT_PROPS: Record<string, string[]> = {
  Heading: ["text"],
  Paragraph: ["text"],
  Text: ["text"],
  Button: ["label"],
  Link: ["text", "label"],
  "Hero Section": ["title", "subtitle", "highlightText"],
  "Section Heading": ["title", "subtitle", "highlightText"],
};

/** Prop keys that hold searchable text on ANY node (in addition to per-type). */
export const GENERIC_TEXT_PROPS = ["text", "label", "title", "subtitle", "highlightText"];

export interface CraftNodeLike {
  data?: {
    displayName?: string;
    props?: Record<string, unknown>;
  };
}

/** The searchable string prop keys for a node (union of type-specific + generic). */
export function textPropKeysFor(node: CraftNodeLike): string[] {
  const name = node.data?.displayName ?? "";
  const props = node.data?.props ?? {};
  const keys = new Set<string>(SEARCH_TEXT_PROPS[name] ?? []);
  // Also include any generic text prop that actually holds a string on this node,
  // so blocks not in the map still participate when they carry text.
  for (const k of GENERIC_TEXT_PROPS) {
    if (typeof props[k] === "string") keys.add(k);
  }
  return [...keys];
}

export interface Match {
  nodeId: string;
  propKey: string;
  /** The full current prop value (so Replace can rebuild it). */
  value: string;
  /** Number of occurrences of the term within this prop value. */
  count: number;
}

/** Build a global RegExp for the term honoring case + whole-word toggles. */
export function buildRegex(term: string, caseSensitive: boolean, wholeWord: boolean): RegExp | null {
  if (!term) return null;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
  try {
    return new RegExp(pattern, caseSensitive ? "g" : "gi");
  } catch {
    return null;
  }
}

/** Count non-overlapping matches of `re` in `value`. */
function countMatches(value: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(value) !== null) {
    n++;
    if (re.lastIndex === 0) break; // guard zero-width
  }
  return n;
}

/**
 * Scan a Craft node map for text matches. Returns one entry per matching
 * (node, prop) with the occurrence count — in a stable order for prev/next.
 */
export function findMatches(
  nodes: Record<string, CraftNodeLike>,
  term: string,
  caseSensitive: boolean,
  wholeWord: boolean,
): Match[] {
  const re = buildRegex(term, caseSensitive, wholeWord);
  if (!re) return [];
  const out: Match[] = [];
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (nodeId === "ROOT") continue;
    const props = node.data?.props ?? {};
    for (const key of textPropKeysFor(node)) {
      const v = props[key];
      if (typeof v !== "string" || v.length === 0) continue;
      const count = countMatches(v, re);
      if (count > 0) out.push({ nodeId, propKey: key, value: v, count });
    }
  }
  return out;
}

/** Total occurrence count across all matches. */
export function totalOccurrences(matches: Match[]): number {
  return matches.reduce((sum, m) => sum + m.count, 0);
}

/** Replace all occurrences in a single value. */
export function replaceInValue(
  value: string,
  term: string,
  replacement: string,
  caseSensitive: boolean,
  wholeWord: boolean,
): string {
  const re = buildRegex(term, caseSensitive, wholeWord);
  if (!re) return value;
  return value.replace(re, replacement);
}

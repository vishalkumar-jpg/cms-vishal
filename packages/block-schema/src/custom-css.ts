/**
 * Per-node custom CSS — stored on the StyleModel as `customCss`, sanitized and
 * scoped at render time to `[data-ob-node="<id>"]` so author rules never leak
 * globally. Pure / SSR-safe (string work only).
 */

export const NODE_SCOPE_ATTR = "data-ob-node";

const MAX_CUSTOM_CSS_LEN = 16_384;

const FORBIDDEN_PATTERNS: RegExp[] = [
  /@import\b/i,
  /javascript\s*:/i,
  /expression\s*\(/i,
  /-moz-binding/i,
  /\bbehavior\s*:/i,
  /<\s*\/?\s*style\b/i,
  /url\s*\(\s*["']?\s*data\s*:/i,
];

const asDict = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Read raw custom CSS from a StyleModel (or props bag containing `styles`). */
export const getCustomCss = (styles: unknown): string | undefined => {
  const raw = asDict(styles).customCss;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
};

/** Strip dangerous constructs; returns empty string when nothing safe remains. */
export const sanitizeCustomCss = (css: string): string => {
  const out = css.trim();
  if (!out || out.length > MAX_CUSTOM_CSS_LEN) return "";
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(out)) return "";
  }
  return out;
};

/** Escape a node id for use inside a double-quoted attribute selector. */
const escapeAttr = (nodeId: string): string =>
  nodeId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/**
 * How `&` / bare declaration blocks target the block root:
 *  - `node`  — attribute sits on the component root (builder canvas).
 *  - `child` — attribute sits on a `display:contents` wrapper (published SSR).
 */
export type CustomCssScopeTarget = "node" | "child";

const scopeSelectorList = (
  selector: string,
  scope: string,
  selfSel: string,
): string =>
  selector
    .split(",")
    .map((part) => {
      const s = part.trim();
      if (!s) return "";
      if (s === "&" || s === ":scope") return selfSel;
      if (s.startsWith("&")) return s.replace(/^&/, selfSel);
      return `${scope} ${s}`;
    })
    .filter(Boolean)
    .join(", ");

/** Recursively prefix selectors inside a CSS string (handles nested @-rules). */
const scopeRuleBlock = (css: string, scope: string, selfSel: string): string => {
  let result = "";
  let i = 0;
  const len = css.length;

  while (i < len) {
    while (i < len && /\s/.test(css[i] ?? "")) i++;
    if (i >= len) break;

    if (css[i] === "@") {
      const start = i;
      const brace = css.indexOf("{", i);
      if (brace < 0) break;
      const header = css.slice(start, brace + 1);
      let depth = 1;
      let j = brace + 1;
      while (j < len && depth > 0) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") depth--;
        j++;
      }
      const inner = css.slice(brace + 1, j - 1);
      result += header + scopeRuleBlock(inner, scope, selfSel) + "}";
      i = j;
      continue;
    }

    const brace = css.indexOf("{", i);
    if (brace < 0) break;
    const selector = css.slice(i, brace).trim();
    let depth = 1;
    let j = brace + 1;
    while (j < len && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(brace + 1, j - 1);
    result += `${scopeSelectorList(selector, scope, selfSel)}{${body}}`;
    i = j;
  }

  return result;
};

/**
 * Prefix every selector with `[data-ob-node="<id>"]` so rules apply only inside
 * the selected node subtree.
 */
export const scopeCustomCss = (
  css: string,
  nodeId: string,
  target: CustomCssScopeTarget = "node",
): string => {
  const safe = sanitizeCustomCss(css);
  if (!safe || !nodeId) return "";
  const scope = `[${NODE_SCOPE_ATTR}="${escapeAttr(nodeId)}"]`;
  const selfSel = target === "child" ? `${scope} > *` : scope;

  if (!safe.includes("{")) {
    return `${selfSel}{${safe}}`;
  }

  return scopeRuleBlock(safe, scope, selfSel);
};

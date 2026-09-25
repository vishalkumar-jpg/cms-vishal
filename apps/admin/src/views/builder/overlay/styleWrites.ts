import type { useEditor } from "@craftjs/core";
import { mergeStyleModelAtBreakpoint, type StyleModel } from "@ob-cms/block-schema";
import type { Breakpoint } from "../property/styleTokens";
import { styleBreakpointKey } from "../store/editorUiStore";

/**
 * Breakpoint-aware StyleModel write helpers for the direct-manipulation overlay.
 *
 * These DO NOT change the StyleModel shape (a concurrent agent owns
 * `packages/block-schema`). They write into the EXACT same paths the property
 * panel's StyleControls already use, via Craft's `actions.setProp`, so every
 * resize / spacing / position edit flows through Craft => autosave + undo/redo
 * and respects the active device:
 *
 *   - desktop       -> `styles.<section>.<key>`
 *   - largeDesktop  -> `styles.responsive.largeDesktop.<section>.<key>`
 *   - laptop        -> `styles.responsive.laptop.<section>.<key>`
 *   - tablet        -> `styles.responsive.tablet.<section>.<key>`
 *   - mobile        -> `styles.responsive.mobile.<section>.<key>`
 *
 * Sections used here (all already part of the StyleModel):
 *   - `sizing`  : width / height               (resolveStyles -> width/height)
 *   - `spacing` : padding / margin              (resolveStyles -> padding/margin)
 *
 * We intentionally write raw numbers (px). `resolveStyles` already turns a bare
 * number into `"<n>px"`, matching what the Style panel's scale fields store.
 */

type EditorActions = ReturnType<typeof useEditor>["actions"];
type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict =>
  v != null && typeof v === "object" && !Array.isArray(v);

const asDict = (v: unknown): Dict => (isDict(v) ? v : {});

/** The style sub-tree effective at the current breakpoint (base + inherited overrides). */
export const styleSource = (styles: Dict, breakpoint: Breakpoint): Dict =>
  mergeStyleModelAtBreakpoint(styles as StyleModel, styleBreakpointKey(breakpoint)) as Dict;

/** The dot-path prefix for the current breakpoint (mirrors StyleControls). */
const prefixFor = (breakpoint: Breakpoint): string => {
  const bp = styleBreakpointKey(breakpoint);
  return bp === "desktop" ? "styles" : `styles.responsive.${bp}`;
};

/** Read a numeric style value (`section.key`) at the active breakpoint. */
export const readNum = (
  styles: Dict,
  breakpoint: Breakpoint,
  section: string,
  key: string,
): number | null => {
  const src = styleSource(styles, breakpoint);
  const raw = asDict(src[section])[key];
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Set a (dot-pathed) prop on a node via Craft's setProp — same algo as useUpdateProp. */
const setNested = (target: Dict, path: string, value: unknown): void => {
  const keys = path.split(".");
  let cursor: Dict = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const k = keys[i];
    if (!isDict(cursor[k])) cursor[k] = {};
    cursor = cursor[k] as Dict;
  }
  cursor[keys[keys.length - 1]] = value;
};

/**
 * Write one or more `section.key = value` pairs at the active breakpoint in a
 * SINGLE setProp call, so the whole gesture step is one undo unit. `undefined`
 * clears a key (matches the panel's reset behavior).
 */
export const writeStyles = (
  actions: EditorActions,
  nodeId: string,
  breakpoint: Breakpoint,
  edits: { section: string; key: string; value: number | string | undefined }[],
): void => {
  const prefix = prefixFor(breakpoint);
  actions.setProp(nodeId, (props: Dict) => {
    for (const { section, key, value } of edits) {
      setNested(props, `${prefix}.${section}.${key}`, value === undefined ? undefined : value);
    }
  });
};

export type SizingKey = "width" | "height";
export type SpacingKey =
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft";

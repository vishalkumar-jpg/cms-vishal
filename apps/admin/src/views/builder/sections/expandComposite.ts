import type { SerializedLayout } from "@ob-cms/block-schema";

/**
 * COMPOSITE → NODE-TREE EXPANSION ("Convert to Builder Component").
 *
 * A handful of marketing blocks (`Hero Section`, `Feature List`,
 * `Counter Section`, `Step Cards`, `Section Heading`) render their internals as
 * hidden React JSX — so the author can only tweak a fixed set of props, never
 * the actual structure. This module rebuilds each one as an equivalent tree of
 * REAL registered primitives (`Section` / `Container` / `Grid` / `Row` /
 * `Column` / `Div` / `Heading` / `Paragraph` / `Button` / `Image` / `Divider`),
 * carrying the composite's current props + styles across so the visual result is
 * (near) identical, but now EVERY piece is an independent, selectable, movable,
 * duplicable, fully-styleable Craft node.
 *
 * The returned shape mirrors `sectionPresets.ts#sectionLayout`: a
 * `SerializedLayout` rooted at "ROOT" whose single child is the expanded root
 * node. The caller (`useNodeActions.convertToNodes`) runs it through
 * `layoutToCraft` + `buildTreeFromSerializedMap` and swaps it in for the
 * original node — the exact insert path the Section Library already uses, so
 * inserted nodes are normal, fully-editable blocks (fresh ids, no collisions).
 */

/* ------------------------------------------------------------------ */
/* Node-builder helper (same authoring style as sectionPresets)        */
/* ------------------------------------------------------------------ */

interface PNode {
  type: { resolvedName: string };
  isCanvas?: boolean;
  props?: Record<string, unknown>;
  nodes?: PNode[];
  displayName?: string;
}

const CANVAS = new Set([
  "Section",
  "Container",
  "Row",
  "Column",
  "Grid",
  "Div",
  "Footer",
  "Footer Columns",
]);

const n = (
  type: string,
  props: Record<string, unknown> = {},
  nodes: PNode[] = [],
): PNode => ({
  type: { resolvedName: type },
  isCanvas: CANVAS.has(type),
  props,
  nodes,
  displayName: type,
});

const container = (props: Record<string, unknown>, nodes: PNode[]): PNode =>
  n("Container", props, nodes);
const heading = (text: string, level: number, styles?: unknown): PNode =>
  n("Heading", { text, level, ...(styles ? { styles } : {}) });
const paragraph = (text: string, styles?: unknown): PNode =>
  n("Paragraph", { text, ...(styles ? { styles } : {}) });

const DEFAULT_HIGHLIGHT = "#147eff";

/* ------------------------------------------------------------------ */
/* Style helpers                                                      */
/* ------------------------------------------------------------------ */

type Dict = Record<string, unknown>;

const isObj = (v: unknown): v is Dict =>
  v != null && typeof v === "object" && !Array.isArray(v);

/**
 * Convert a flat "mini" style object (the per-part shape used by composite
 * blocks — `{ fontSize, color, textAlign, marginTop, borderRadius, … }`) into a
 * sectioned `StyleModel` so it can drive a primitive's `styles` prop with full
 * editor + renderer parity.
 */
const miniToStyleModel = (mini: unknown): Dict | undefined => {
  if (!isObj(mini)) return undefined;
  const typography: Dict = {};
  const colors: Dict = {};
  const spacing: Dict = {};
  const borders: Dict = {};
  const sizing: Dict = {};

  const set = (target: Dict, key: string, value: unknown): void => {
    if (value !== undefined && value !== null && value !== "") target[key] = value;
  };

  set(typography, "fontSize", mini.fontSize);
  set(typography, "fontWeight", mini.fontWeight);
  set(typography, "lineHeight", mini.lineHeight);
  set(typography, "textAlign", mini.textAlign);
  set(typography, "letterSpacing", mini.letterSpacing);
  set(typography, "textTransform", mini.textTransform);

  set(colors, "textColor", mini.color ?? mini.textColor);
  set(colors, "backgroundColor", mini.backgroundColor);

  set(spacing, "marginTop", mini.marginTop);
  set(spacing, "marginBottom", mini.marginBottom);
  set(spacing, "marginLeft", mini.marginLeft);
  set(spacing, "marginRight", mini.marginRight);
  set(spacing, "paddingTop", mini.paddingTop);
  set(spacing, "paddingBottom", mini.paddingBottom);
  set(spacing, "paddingLeft", mini.paddingLeft);
  set(spacing, "paddingRight", mini.paddingRight);

  set(borders, "borderRadius", mini.borderRadius);
  set(sizing, "width", mini.width);
  set(sizing, "height", mini.height);

  const model: Dict = {};
  if (Object.keys(typography).length) model.typography = typography;
  if (Object.keys(colors).length) model.colors = colors;
  if (Object.keys(spacing).length) model.spacing = spacing;
  if (Object.keys(borders).length) model.borders = borders;
  if (Object.keys(sizing).length) model.sizing = sizing;
  return Object.keys(model).length ? model : undefined;
};

/** Deep-merge two StyleModel-ish dicts (section by section). */
const mergeStyles = (a: unknown, b: unknown): Dict | undefined => {
  const da = isObj(a) ? a : undefined;
  const db = isObj(b) ? b : undefined;
  if (!da) return db;
  if (!db) return da;
  const out: Dict = { ...da };
  for (const [k, v] of Object.entries(db)) {
    out[k] = isObj(v) && isObj(out[k]) ? { ...(out[k] as Dict), ...v } : v;
  }
  return out;
};

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

const isImgUrl = (v: unknown): boolean =>
  typeof v === "string" && /^(https?:)?\/\//.test(v.trim());

/* ------------------------------------------------------------------ */
/* Card sub-builders                                                  */
/* ------------------------------------------------------------------ */

const cardStyles = (): Dict => ({
  colors: { backgroundColor: "hsl(var(--card))" },
  spacing: { paddingTop: 28, paddingBottom: 28, paddingLeft: 24, paddingRight: 24 },
  borders: { borderRadius: 14, borderColor: "hsl(var(--border))", borderWidth: 1 },
});

/** An icon leaf: an <Image> for a URL, else a big glyph <Paragraph>. */
const iconNode = (icon: unknown): PNode | null => {
  if (icon == null || icon === "") return null;
  if (isImgUrl(icon)) {
    return n("Image", {
      imageUrl: String(icon),
      altText: "",
      width: 48,
      height: 48,
      styles: { spacing: { marginBottom: 12 } },
    });
  }
  return paragraph(String(icon), {
    typography: { fontSize: 40, lineHeight: 1 },
    spacing: { marginBottom: 12 },
  });
};

/* ------------------------------------------------------------------ */
/* Per-composite expanders                                            */
/* ------------------------------------------------------------------ */

const expandHero = (p: Dict): PNode => {
  const layout = str(p.layout, "centered");
  const isSplit = layout === "split" && !!p.imageUrl;
  const partStyles = isObj(p.partStyles) ? p.partStyles : {};

  const titleStyles = mergeStyles(
    {
      typography: {
        fontSize: 48,
        fontWeight: 700,
        textAlign: isSplit ? "left" : "center",
      },
      spacing: { marginBottom: 16 },
    },
    miniToStyleModel(partStyles.title),
  );
  const subtitleStyles = mergeStyles(
    {
      typography: { fontSize: 18, textAlign: isSplit ? "left" : "center" },
      colors: { textColor: "hsl(var(--muted-foreground))" },
      spacing: { marginBottom: 32, marginLeft: isSplit ? 0 : "auto", marginRight: isSplit ? 0 : "auto" },
      sizing: { maxWidth: 720 },
    },
    miniToStyleModel(partStyles.subtitle),
  );

  // CTA buttons — one Button node per configured button (fully editable).
  const buttons = Array.isArray(p.buttons) ? (p.buttons as Dict[]) : [];
  const ctaButtons =
    buttons.length > 0
      ? buttons
      : p.ctaText
        ? [{ label: p.ctaText, url: p.ctaUrl, styles: p.ctaStyles }]
        : [];
  const buttonNodes: PNode[] = ctaButtons.map((b, i) =>
    n("Button", {
      label: str(b.label, "Button"),
      url: str(b.url, "#"),
      variant: i === 0 ? "primary" : "secondary",
      ...(i === 0 && p.ctaIcon ? { iconAfter: str(p.ctaIcon) } : {}),
      ...(isObj(b.styles) ? { partStyles: b.styles } : {}),
    }),
  );

  const showCta = p.showCta !== false && buttonNodes.length > 0;

  const textChildren: PNode[] = [
    heading(str(p.title, "Headline"), 1, titleStyles),
    paragraph(str(p.subtitle, ""), subtitleStyles),
    ...(showCta
      ? [
          n(
            "Div",
            {
              styles: {
                layout: {
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  justifyContent: isSplit ? "flex-start" : "center",
                },
              },
            },
            buttonNodes,
          ),
        ]
      : []),
  ];

  const imageNode = p.imageUrl
    ? n("Image", {
        imageUrl: str(p.imageUrl),
        altText: str(p.title, "Hero"),
        styles: mergeStyles(
          { borders: { borderRadius: 16 } },
          miniToStyleModel(partStyles.image),
        ),
      })
    : null;

  const body: PNode = isSplit
    ? n(
        "Row",
        {
          styles: {
            layout: { display: "flex", alignItems: "center", gap: 48, flexWrap: "wrap" },
          },
        },
        [
          n("Column", { styles: { sizing: { width: "50%" }, layout: {} } }, textChildren),
          n(
            "Column",
            { styles: { sizing: { width: "50%" } } },
            imageNode ? [imageNode] : [],
          ),
        ],
      )
    : n("Div", {}, [...textChildren, ...(imageNode ? [imageNode] : [])]);

  const sectionStyles = mergeStyles(
    {
      spacing: { paddingTop: 96, paddingBottom: 96, paddingLeft: 24, paddingRight: 24 },
      typography: { textAlign: isSplit ? "left" : "center" },
    },
    p.styles,
  );

  return n("Section", { styles: sectionStyles }, [
    container(
      { maxWidth: 1180, styles: { sizing: { maxWidth: 1180 }, spacing: { marginLeft: "auto", marginRight: "auto" } } },
      [body],
    ),
  ]);
};

const expandFeatureList = (p: Dict): PNode => {
  const columns = typeof p.columns === "number" ? p.columns : 3;
  const list = Array.isArray(p.features) ? (p.features as Dict[]) : [];
  const features = list.length
    ? list
    : [
        { title: "Feature", description: "Describe the feature.", icon: "" },
        { title: "Feature", description: "Describe the feature.", icon: "" },
        { title: "Feature", description: "Describe the feature.", icon: "" },
      ];

  const cards = features.map((f) => {
    const children: PNode[] = [];
    const icon = iconNode(f.icon);
    if (icon) children.push(icon);
    children.push(
      heading(str(f.title, "Feature"), 3, {
        typography: { fontSize: 20, fontWeight: 700 },
        colors: { textColor: "hsl(var(--foreground))" },
        spacing: { marginBottom: 8 },
      }),
    );
    children.push(
      paragraph(str(f.description, ""), {
        typography: { lineHeight: 1.6 },
        colors: { textColor: "hsl(var(--muted-foreground))" },
      }),
    );
    return n("Column", { styles: cardStyles() }, children);
  });

  return n(
    "Grid",
    {
      columns,
      styles: mergeStyles(
        {
          layout: {
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          },
          spacing: { gap: 24 },
        },
        p.styles,
      ),
    },
    cards,
  );
};

const expandCounter = (p: Dict): PNode => {
  const columns = typeof p.columns === "number" ? p.columns : 3;
  const cardStyle = p.cardStyle !== false;
  const list = Array.isArray(p.stats) ? (p.stats as Dict[]) : [];
  const stats = list.length
    ? list
    : [
        { value: "100+", label: "Label", description: "" },
        { value: "24/7", label: "Label", description: "" },
        { value: "99%", label: "Label", description: "" },
      ];

  const cards = stats.map((s) => {
    const children: PNode[] = [
      heading(str(s.value, "0"), 2, {
        typography: { fontSize: 48, fontWeight: 700, lineHeight: 1.1, textAlign: "center" },
      }),
      paragraph(str(s.label, ""), {
        typography: { fontSize: 18, fontWeight: 700, textAlign: "center" },
        spacing: { marginTop: 8 },
      }),
    ];
    if (s.description) {
      children.push(
        paragraph(str(s.description), {
          typography: { fontSize: 14, textAlign: "center", lineHeight: 1.6 },
          colors: { textColor: "hsl(var(--muted-foreground))" },
          spacing: { marginTop: 12 },
        }),
      );
    }
    return n("Column", { styles: cardStyle ? cardStyles() : { typography: { textAlign: "center" } } }, children);
  });

  return n(
    "Grid",
    {
      columns,
      styles: mergeStyles(
        {
          layout: { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)` },
          spacing: { gap: 32 },
        },
        p.styles,
      ),
    },
    cards,
  );
};

const expandStepCards = (p: Dict): PNode => {
  const columns = typeof p.columns === "number" ? p.columns : 3;
  const list = Array.isArray(p.steps) ? (p.steps as Dict[]) : [];
  const steps = list.length
    ? list
    : [
        { number: "1", title: "Step one", description: "" },
        { number: "2", title: "Step two", description: "" },
        { number: "3", title: "Step three", description: "" },
      ];

  const cards = steps.map((s) => {
    const children: PNode[] = [];
    if (isImgUrl(s.iconUrl)) {
      children.push(
        n("Image", { imageUrl: String(s.iconUrl), altText: "", width: 56, height: 56, styles: { spacing: { marginBottom: 12 } } }),
      );
    } else if (s.number) {
      children.push(
        heading(str(s.number), 3, {
          typography: { fontSize: 32, fontWeight: 800 },
          colors: { textColor: "hsl(var(--primary))" },
          spacing: { marginBottom: 12 },
        }),
      );
    }
    children.push(
      heading(str(s.title, "Step"), 3, {
        typography: { fontSize: 20, fontWeight: 700 },
        colors: { textColor: "hsl(var(--foreground))" },
        spacing: { marginBottom: 12 },
      }),
    );
    children.push(
      paragraph(str(s.description, ""), {
        typography: { fontSize: 15, lineHeight: 1.6 },
        colors: { textColor: "hsl(var(--muted-foreground))" },
      }),
    );
    return n("Column", { styles: cardStyles() }, children);
  });

  return n(
    "Grid",
    {
      columns,
      styles: mergeStyles(
        {
          layout: { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)` },
          spacing: { gap: 32 },
        },
        p.styles,
      ),
    },
    cards,
  );
};

const expandSectionHeading = (p: Dict): PNode => {
  const align = str(p.align, "center");
  const children: PNode[] = [];
  if (p.subtitle) {
    children.push(
      paragraph(str(p.subtitle), {
        typography: { textTransform: "uppercase", letterSpacing: 1, fontSize: 13, fontWeight: 700, textAlign: align },
        colors: { textColor: "hsl(var(--primary))" },
        spacing: { marginBottom: 8 },
      }),
    );
  }
  children.push(
    n("Heading", {
      text: str(p.title, "Heading"),
      level: 2,
      ...(p.highlightText ? { highlightText: p.highlightText } : {}),
      highlightColor: str(p.highlightColor, DEFAULT_HIGHLIGHT),
      styles: {
        typography: { fontSize: 36, fontWeight: 700, lineHeight: 1.15, textAlign: align },
        colors: { textColor: "hsl(var(--foreground))" },
      },
    }),
  );
  return n("Div", { styles: mergeStyles({ typography: { textAlign: align } }, p.styles) }, children);
};

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

type Expander = (props: Dict) => PNode;

const EXPANDERS: Record<string, Expander> = {
  "Hero Section": expandHero,
  "Feature List": expandFeatureList,
  "Counter Section": expandCounter,
  "Step Cards": expandStepCards,
  "Section Heading": expandSectionHeading,
};

/** Block types that "Convert to Builder Component" can expand into nodes. */
export const CONVERTIBLE_COMPOSITE_TYPES = new Set(Object.keys(EXPANDERS));

/** Is this block type convertible into an editable node tree? */
export const isConvertibleComposite = (resolvedName: string | undefined): boolean =>
  !!resolvedName && CONVERTIBLE_COMPOSITE_TYPES.has(resolvedName);

let idCounter = 0;
const freshId = (): string =>
  `cvt_${Date.now().toString(36)}_${(idCounter++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Expand a composite block (`resolvedName` + its `props`) into a
 * `SerializedLayout` (root "ROOT" wrapping the single expanded root node), with
 * fresh, collision-free ids. Returns `null` for non-convertible types.
 */
export const expandCompositeToLayout = (
  resolvedName: string,
  props: Record<string, unknown>,
): SerializedLayout | null => {
  const expander = EXPANDERS[resolvedName];
  if (!expander) return null;

  const root = expander(props ?? {});
  const nodes: SerializedLayout["nodes"] = {};

  const walk = (node: PNode, parent: string): string => {
    const id = freshId();
    const childIds = (node.nodes ?? []).map((c) => walk(c, id));
    nodes[id] = {
      type: node.type,
      isCanvas: node.isCanvas ?? false,
      props: (node.props ?? {}) as Record<string, unknown>,
      displayName: node.displayName ?? node.type.resolvedName,
      custom: {},
      parent,
      hidden: false,
      nodes: childIds,
      linkedNodes: {},
    };
    return id;
  };

  const rootChildId = walk(root, "ROOT");
  nodes["ROOT"] = {
    type: { resolvedName: "Section" },
    isCanvas: true,
    props: {},
    displayName: "Section",
    custom: {},
    parent: null,
    hidden: false,
    nodes: [rootChildId],
    linkedNodes: {},
  };

  return { schemaVersion: "2.0", root: "ROOT", nodes };
};

/* ------------------------------------------------------------------ */
/* Whole-map expansion (auto-convert on load / on insert)             */
/* ------------------------------------------------------------------ */

/** The `resolvedName` for a serialized node (string or `{ resolvedName }`). */
const nameOf = (node: unknown): string | undefined => {
  const t = (node as { type?: unknown } | undefined)?.type;
  return typeof t === "string" ? t : (t as { resolvedName?: string } | undefined)?.resolvedName;
};

/**
 * Expand EVERY convertible composite in a Craft node map into its equivalent
 * primitive subtree, in place — the composite node is replaced (at the same
 * position under its parent) by the expanded root, its descendants are added,
 * and the composite node is removed. Fresh, collision-free ids are used for the
 * inserted primitives.
 *
 * This is the "auto-convert on open" path: the builder passes a page's loaded
 * node map through this before hydrating Craft, so a saved page built from
 * composites (Hero Section / Feature List / …) opens as a fully node-based,
 * selectable/editable tree. Returns the new map plus a `changed` flag so the
 * caller can skip re-serializing an untouched (already-primitive) page.
 *
 * Pure data transform (no React / Craft) → safe to run before `<Frame>` mounts.
 */
export const expandLayoutComposites = (
  input: Record<string, unknown>,
): { nodes: Record<string, unknown>; changed: boolean } => {
  const compositeIds = Object.keys(input).filter((id) =>
    isConvertibleComposite(nameOf(input[id])),
  );
  if (compositeIds.length === 0) {
    return { nodes: input, changed: false };
  }

  const out: Record<string, unknown> = {};
  for (const [id, node] of Object.entries(input)) {
    const n0 = node as { nodes?: string[]; linkedNodes?: Record<string, string> };
    out[id] = {
      ...(node as Record<string, unknown>),
      nodes: Array.isArray(n0.nodes) ? [...n0.nodes] : [],
      linkedNodes: { ...(n0.linkedNodes ?? {}) },
    };
  }

  let changed = false;
  for (const id of compositeIds) {
    const node = out[id] as { type?: unknown; props?: Record<string, unknown>; parent?: string | null };
    const name = nameOf(node);
    if (!name) continue;
    const layout = expandCompositeToLayout(name, node.props ?? {});
    if (!layout) continue;

    const wrapper = layout.nodes["ROOT"] as { nodes?: string[] } | undefined;
    const expRootId = wrapper?.nodes?.[0];
    if (!expRootId) continue;

    // Copy the expanded descendants (everything except the "ROOT" wrapper).
    for (const [eid, enode] of Object.entries(layout.nodes)) {
      if (eid === "ROOT") continue;
      out[eid] = enode;
    }

    // Reparent the expanded root to where the composite lived.
    const parentId = node.parent ?? null;
    (out[expRootId] as { parent?: string | null }).parent = parentId;

    // Swap the composite id for the expanded root in its parent's child list
    // (preserving position), then drop the composite node.
    if (parentId && out[parentId]) {
      const arr = (out[parentId] as { nodes: string[] }).nodes;
      const idx = arr.indexOf(id);
      if (idx >= 0) arr[idx] = expRootId;
      else arr.push(expRootId);
    }
    delete out[id];
    changed = true;
  }

  return { nodes: out, changed };
};

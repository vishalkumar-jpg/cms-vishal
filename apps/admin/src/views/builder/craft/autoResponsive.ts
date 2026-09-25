import { generateResponsiveStyles, type SerializedLayout } from "@ob-cms/block-schema";

/**
 * Auto-responsive generation pass applied on every draft save (and therefore on
 * publish, which ships the last saved draft). Walks every node in the serialized
 * layout and derives tablet + mobile override layers from its desktop StyleModel
 * via `generateResponsiveStyles` (stacks columns, shrinks fonts, fluidises fixed
 * widths). Runs on the SAVE PAYLOAD only — never on the live Craft state — so it
 * can't trigger editor re-renders or feedback loops, and manual per-breakpoint
 * overrides are preserved (see `generateResponsiveStyles`).
 *
 * Pure + returns a fresh object; the input layout is untouched.
 */
export const applyAutoResponsiveToLayout = (layout: SerializedLayout): SerializedLayout => {
  let clone: SerializedLayout;
  try {
    clone =
      typeof structuredClone === "function"
        ? structuredClone(layout)
        : (JSON.parse(JSON.stringify(layout)) as SerializedLayout);
  } catch {
    return layout;
  }

  const nodes = clone.nodes as Record<string, { props?: Record<string, unknown> }>;
  for (const node of Object.values(nodes)) {
    const props = node?.props;
    if (!props || typeof props !== "object") continue;

    if (props.styles && typeof props.styles === "object") {
      props.styles = generateResponsiveStyles(props.styles);
    }

    // Composite blocks (Hero, etc.) carry per-sub-part StyleModels — make those
    // responsive too so a fixed-width image inside a Hero also adapts.
    if (props.partStyles && typeof props.partStyles === "object") {
      const parts = props.partStyles as Record<string, unknown>;
      for (const key of Object.keys(parts)) {
        if (parts[key] && typeof parts[key] === "object") {
          parts[key] = generateResponsiveStyles(parts[key]);
        }
      }
    }
  }

  return clone;
};

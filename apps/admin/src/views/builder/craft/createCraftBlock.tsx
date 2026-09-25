import * as React from "react";
import { useNode, type UserComponent } from "@craftjs/core";
import type { BlockRegistryEntry } from "@ob-cms/blocks";
import { BlockEditingContext, NodeBindingContext, ScopedCustomStyle } from "@ob-cms/blocks";
import type { Bindings, VisibleIf, BindingContext, StyleModel } from "@ob-cms/block-schema";
import {
  evaluateVisibleIf,
  getCustomCss,
  NODE_SCOPE_ATTR,
  isHiddenAtBreakpointForPreview,
} from "@ob-cms/block-schema";
import { useEditorUiStore, styleBreakpointKey } from "../store/editorUiStore";

/**
 * Wraps a Craft-agnostic @ob-cms/blocks component into a Craft.js UserComponent.
 *
 * Editor↔renderer parity: the SAME shared component is rendered here as in the
 * Next.js renderer (`RenderLayout`) — no editor-only wrapper boxes. Craft's
 * drag/select connectors are attached to the block's REAL root DOM element via
 * the component's forwarded `ref`, so Craft can hit-test it: precise drop
 * positioning, click-to-select (including nested blocks), reorder and delete all
 * work. (A previous `display:contents` wrapper had no layout box, which broke
 * drag-drop positioning and nested selection.)
 *
 * Canvas blocks render their DIRECT child nodes (Craft passes them as
 * `children`) — the same model the renderer uses — so imported trees display and
 * `query.serialize()` round-trips to the renderer's format.
 */
export const createCraftBlock = (
  name: string,
  entry: BlockRegistryEntry,
): UserComponent<Record<string, unknown>> => {
  const Shared = entry.component as React.ComponentType<Record<string, unknown>>;
  const isCanvas = entry.isCanvas;

  const CraftBlock: UserComponent<Record<string, unknown>> = (props) => {
    const {
      id,
      connectors: { connect, drag },
      selected,
      hovered,
      bindings,
      visibleIf,
      actions: { setProp },
    } = useNode((node) => ({
      selected: node.events.selected,
      hovered: node.events.hovered,
      // Data-binding: bindings + a visibility cond live in Craft `custom` (the
      // only arbitrary node field Craft serializes); `craftToLayout` hoists them
      // to top-level `bindings`/`visibleIf` for the renderer.
      bindings: (node.data.custom as { bindings?: Bindings } | undefined)?.bindings,
      visibleIf: (node.data.custom as { visibleIf?: VisibleIf } | undefined)?.visibleIf,
    }));

    // Multi-select (Shift+Click): a node may be a member of the secondary
    // selection on top of Craft's single primary selection. We read membership
    // to paint the combined outline, and toggle it on shift-click.
    const isMultiSelected = useEditorUiStore((s) => s.extraSelected.includes(id));
    const toggleExtraSelected = useEditorUiStore((s) => s.toggleExtraSelected);
    const clearExtraSelected = useEditorUiStore((s) => s.clearExtraSelected);
    // SUB-PART EDITING — select an internal region (title/image/button/…) of a
    // composite block. Parts are tagged with `data-subpart` in the shared block.
    const setSubPart = useEditorUiStore((s) => s.setSubPart);
    const clearSubPart = useEditorUiStore((s) => s.clearSubPart);
    const stylePreviewState = useEditorUiStore((s) => s.stylePreviewState);
    const activeBreakpoint = useEditorUiStore((s) => s.breakpoint);
    const hiddenOnDevice = React.useMemo(() => {
      const bp = styleBreakpointKey(activeBreakpoint);
      return isHiddenAtBreakpointForPreview(props.styles as StyleModel | undefined, bp);
    }, [props.styles, activeBreakpoint]);

    // Inline editing: a block's text becomes editable when its node is selected.
    // `commit` writes the new plain text back to the block's prop via Craft's
    // setProp, which triggers the builder's autosave and updates the side panel.
    const editingValue = React.useMemo(
      () => ({
        editing: selected,
        commit: (key: string, val: string) =>
          setProp((p: Record<string, unknown>) => {
            p[key] = val;
          }),
      }),
      [selected, setProp],
    );

    const elRef = React.useRef<HTMLElement | null>(null);

    // DUAL-MODE — in Content mode we attach ONLY the select connector (no drag),
    // so blocks stay selectable + inline-editable but can't be dragged/reordered.
    // Structure mode gets the full connect+drag. Reading the mode here re-runs the
    // ref callback on switch, so `draggable` is added/removed immediately.
    const editMode = useEditorUiStore((s) => s.editMode);

    // Attach Craft's connect (+drag in Structure mode) to the block's real root
    // DOM (forwarded ref).
    const setRef = React.useCallback(
      (el: HTMLElement | null) => {
        elRef.current = el;
        if (!el) return;
        // Tag the block root with its node id so sub-part hit-testing can confirm
        // which (innermost) block owns a tagged part.
        el.setAttribute("data-craft-node-id", id);
        el.setAttribute(NODE_SCOPE_ATTR, id);
        if (selected && stylePreviewState) {
          el.setAttribute("data-ob-preview-state", stylePreviewState);
        } else {
          el.removeAttribute("data-ob-preview-state");
        }
        if (editMode === "structure") connect(drag(el));
        else connect(el);
      },
      [connect, drag, editMode, id, selected, stylePreviewState],
    );

    // Shift+Click toggles this node in/out of the secondary multi-selection.
    // A plain click clears it (handled in the capture-phase listener below so we
    // run before Craft's own select). Without shift, Craft selects normally.
    // Plain clicks also resolve a sub-part: if the click landed on a tagged
    // `data-subpart` element owned by THIS block, select that part; otherwise
    // clear any sub-part so the whole block is edited.
    React.useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      const onClick = (e: MouseEvent): void => {
        if (e.shiftKey) {
          e.stopPropagation();
          toggleExtraSelected(id);
          return;
        }
        clearExtraSelected();
        const target = e.target as Element | null;
        const partEl = target?.closest("[data-subpart]") ?? null;
        // Only handle it here if this block is the part's nearest block owner
        // (prevents ancestor blocks from claiming a descendant's sub-part).
        if (partEl && partEl.closest("[data-craft-node-id]") === el) {
          setSubPart({
            nodeId: id,
            key: partEl.getAttribute("data-subpart") ?? "",
            label: partEl.getAttribute("data-subpart-label") ?? "Part",
            textPath: partEl.getAttribute("data-subpart-text") ?? undefined,
            stylePath: partEl.getAttribute("data-subpart-style") ?? undefined,
            imagePath: partEl.getAttribute("data-subpart-image") ?? undefined,
          });
        } else if (el.contains(target)) {
          clearSubPart();
        }
      };
      el.addEventListener("click", onClick, true);
      return () => el.removeEventListener("click", onClick, true);
    }, [id, toggleExtraSelected, clearExtraSelected, setSubPart, clearSubPart]);

    // Selection/hover affordance painted directly on the connected DOM element
    // (the shared component owns its inline styles; we only add an outline +
    // pointer, re-applied after each render since React may reset the attribute).
    React.useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      el.style.outline = selected
        ? "2px solid hsl(var(--primary))"
        : isMultiSelected
          ? "2px dashed hsl(var(--primary))"
          : hovered
            ? "1px dashed hsl(var(--ring))"
            : "";
      el.style.outlineOffset = "2px";
      el.style.cursor = "pointer";
    }, [hovered, isMultiSelected, selected]);

    // An EMPTY canvas block collapses to zero height and can't be dropped into.
    // In the editor only, give it a visible min-height "drop here" placeholder so
    // the first child has somewhere to land. Skip for legacy Navbar menus that
    // are driven by `navItems` / `links` props (no canvas children needed).
    const passed = props["children"] as React.ReactNode;
    const legacyNavbarContent =
      name === "Navbar" &&
      (props.mode === "legacy" ||
        ((Array.isArray(props.navItems) ? props.navItems : []) as unknown[]).length > 0 ||
        ((Array.isArray(props.links) ? props.links : []) as unknown[]).length > 0);
    const isEmpty = isCanvas && React.Children.count(passed) === 0 && !legacyNavbarContent;
    const children = isEmpty ? (
      <div
        data-ob-editor-placeholder
        className="ob-editor-canvas-placeholder flex items-center justify-center text-xs text-muted-foreground"
        style={{
          minHeight: 72,
          width: "100%",
          border: "2px dashed hsl(var(--border))",
          borderRadius: 8,
        }}
      >
        Drop blocks here
      </div>
    ) : (
      passed
    );

    // Conditional visibility (editor): we never truly hide a node in the builder
    // (authors must still select + edit it) — instead we paint a "hidden"
    // affordance (dimmed + a badge) when the condition would hide it on the
    // published site. Evaluated against an editor render env (no live locale /
    // item here → a best-effort preview; the renderer does the real hiding).
    const wouldHide =
      !!visibleIf &&
      visibleIf.type !== "always" &&
      !evaluateVisibleIf(visibleIf, {} as BindingContext);

    const shared = (
      <Shared {...props} ref={setRef as React.Ref<HTMLElement>}>
        {children}
      </Shared>
    );

    // Provide this node's bindings so descendant `useBoundProp` calls resolve
    // against the current Repeater sample item (editor↔renderer parity).
    const bound = bindings && Object.keys(bindings).length > 0 ? (
      <NodeBindingContext.Provider value={bindings}>{shared}</NodeBindingContext.Provider>
    ) : (
      shared
    );

    const content = wouldHide ? (
      <div style={{ position: "relative", opacity: 0.45 }} title="Hidden by a visibility condition on the published site">
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            zIndex: 2,
            padding: "1px 6px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 600,
            background: "#fee2e2",
            color: "#b91c1c",
            pointerEvents: "none",
          }}
        >
          hidden
        </span>
        {bound}
      </div>
    ) : hiddenOnDevice ? (
      <div
        style={{ display: "none" }}
        aria-hidden
        data-ob-device-hidden={styleBreakpointKey(activeBreakpoint)}
      >
        {bound}
      </div>
    ) : (
      bound
    );

    const customCss = getCustomCss(props.styles);

    return (
      <BlockEditingContext.Provider value={editingValue}>
        {customCss ? <ScopedCustomStyle nodeId={id} css={customCss} target="node" /> : null}
        {content}
      </BlockEditingContext.Provider>
    );
  };

  CraftBlock.craft = {
    displayName: name,
    props: entry.defaultProps,
    isCanvas,
    rules: {
      // GUARDRAILS: a locked node (custom.guardrails.locked) can't be dragged.
      // Designers unlock first to reposition — keeps brand-locked blocks fixed.
      // DUAL-MODE: Content mode disables dragging entirely (authoritative gate
      // Craft checks at drag-start, so this holds even if a stray `draggable`
      // attribute lingers).
      canDrag: (node?: {
        data?: { custom?: { guardrails?: { locked?: boolean }; layer?: { locked?: boolean } } };
      }) => {
        if (useEditorUiStore.getState().editMode === "content") return false;
        if (node?.data?.custom?.guardrails?.locked === true) return false;
        // Layers-panel editor lock (custom.layer.locked) also pins the node.
        return node?.data?.custom?.layer?.locked !== true;
      },
      canMoveIn: () => isCanvas,
      canMoveOut: () => true,
    },
  };

  return CraftBlock;
};

/**
 * Kept for resolver compatibility (older serialized templates may reference a
 * named canvas slot). Renders its children transparently. New canvas blocks no
 * longer use this — they render their direct children instead.
 */
export const CanvasSlot: UserComponent<{ children?: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
CanvasSlot.craft = {
  displayName: "CanvasSlot",
  rules: {
    canMoveIn: () => true,
  },
};

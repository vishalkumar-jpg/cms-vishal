"use client";

import * as React from "react";
import { sanitizeText, useMounted, resolveSurfaceStyles, applyPartStyles, mergeVisualStyles } from "../lib";
import { BlockEditingContext } from "../editable-text";

/**
 * Interactive blocks — SSR-safe. They render a sensible static state on the
 * server / first paint (first tab open, all accordion items collapsed, modal
 * closed) and enable interaction after mount. No browser APIs at module load.
 *
 * In the builder canvas, `BlockEditingContext` is provided, so content stays
 * visible/selectable (e.g. the Modal panel is forced open) even though it would
 * be hidden on the published site.
 */

const useIsEditing = (): boolean => React.useContext(BlockEditingContext)?.editing ?? false;
const useInBuilder = (): boolean => React.useContext(BlockEditingContext) != null;

/* ---- Tabs -------------------------------------------------------- */
interface TabItem {
  label?: string;
  content?: string;
}
export const Tabs = React.forwardRef<
  HTMLDivElement,
  { tabs?: TabItem[]; partStyles?: Record<string, unknown>; styles?: unknown }
>(({ tabs = [], partStyles = {}, styles }, ref) => {
    const list = tabs.length ? tabs : [{ label: "Tab 1", content: "Tab content" }];
    const mounted = useMounted();
    const [active, setActive] = React.useState(0);
    const current = Math.min(active, list.length - 1);
    const { wrapper, surface: tabSurface } = resolveSurfaceStyles(styles);
    const tabsListStyle = mergeVisualStyles(
      {},
      partStyles.tabs ? applyPartStyles(partStyles.tabs) : {},
    );
    return (
      <div ref={ref} className="ob-tabs" style={wrapper}>
        <div className="ob-tabs__list" role="tablist" style={tabsListStyle}>
          {list.map((t, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === current}
              className={`ob-tabs__tab ob-btn${i === current ? " ob-tabs__tab--active" : ""}`}
              style={tabSurface}
              onClick={() => mounted && setActive(i)}
            >
              {sanitizeText(t.label) || `Tab ${i + 1}`}
            </button>
          ))}
        </div>
        <div className="ob-tabs__panel" role="tabpanel">
          {sanitizeText(list[current]?.content)}
        </div>
      </div>
    );
  },
);
Tabs.displayName = "Tabs";

/* ---- Accordion / FAQ --------------------------------------------- */
interface AccordionItem {
  title?: string;
  content?: string;
}
export const Accordion = React.forwardRef<
  HTMLDivElement,
  { items?: AccordionItem[]; allowMultiple?: boolean; styles?: unknown }
>(({ items = [], allowMultiple = false, styles }, ref) => {
  const list = items.length ? items : [{ title: "Question?", content: "Answer goes here." }];
  const mounted = useMounted();
  const editing = useIsEditing();
  const [open, setOpen] = React.useState<number[]>([0]);
  const { wrapper, surface: headerSurface } = resolveSurfaceStyles(styles);
  // While editing in the builder, reveal every panel so the copy is readable.
  const isOpen = (i: number): boolean => editing || open.includes(i);
  const toggle = (i: number): void => {
    if (!mounted) return;
    setOpen((prev) =>
      prev.includes(i)
        ? prev.filter((x) => x !== i)
        : allowMultiple
          ? [...prev, i]
          : [i],
    );
  };
  return (
    <div ref={ref} className="ob-accordion" style={wrapper}>
      {list.map((it, i) => (
        <div key={i} className={`ob-accordion__item${isOpen(i) ? " ob-accordion__item--open" : ""}`}>
          <button type="button" className="ob-accordion__header ob-btn" style={headerSurface} onClick={() => toggle(i)} aria-expanded={isOpen(i)}>
            <span>{sanitizeText(it.title) || `Item ${i + 1}`}</span>
            <span className="ob-accordion__chevron" aria-hidden>
              {isOpen(i) ? "−" : "+"}
            </span>
          </button>
          {isOpen(i) ? <div className="ob-accordion__body">{sanitizeText(it.content)}</div> : null}
        </div>
      ))}
    </div>
  );
});
Accordion.displayName = "Accordion";

/* ---- Modal / Popup ----------------------------------------------- */
/** Canvas block: children are the modal content. A trigger button opens it. */
export const Modal = React.forwardRef<
  HTMLDivElement,
  { triggerLabel?: string; title?: string; styles?: unknown; children?: React.ReactNode }
>(({ triggerLabel = "Open", title, styles, children }, ref) => {
  const inBuilder = useInBuilder();
  const [open, setOpen] = React.useState(false);
  const { wrapper, surface: triggerSurface } = resolveSurfaceStyles(styles);
  // In the builder, render the panel inline (always visible) so its child nodes
  const showPanel = inBuilder || open;
  return (
    <div ref={ref} className="ob-modal" style={wrapper}>
      <button type="button" className="ob-modal__trigger ob-btn" style={triggerSurface} onClick={() => setOpen(true)}>
        {sanitizeText(triggerLabel) || "Open"}
      </button>
      {showPanel ? (
        <div className={inBuilder ? "ob-modal__inline" : "ob-modal__overlay"}>
          <div className="ob-modal__dialog" role="dialog" aria-modal="true">
            {!inBuilder ? (
              <button
                type="button"
                className="ob-modal__close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            ) : null}
            {title ? <div className="ob-modal__title">{sanitizeText(title)}</div> : null}
            <div className="ob-modal__content">{children}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
});
Modal.displayName = "Modal";

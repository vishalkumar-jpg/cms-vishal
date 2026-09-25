import * as React from "react";

/**
 * Re-render tick driver for the overlay layer. The overlay reads node DOM rects
 * with `getBoundingClientRect` (viewport coords, like InlineBlockToolbar), so it
 * must re-measure whenever anything that could move those rects happens:
 *
 *   - the canvas scrolls (capture-phase scroll, since the scroll container is
 *     nested inside the builder),
 *   - the window resizes,
 *   - the tracked element resizes (ResizeObserver — e.g. a style edit changed
 *     width/height/padding),
 *   - a structural/prop change re-rendered the tree (caller bumps `deps`).
 *
 * Returns a monotonically increasing tick; consumers read it to force a fresh
 * measurement pass. Measuring itself stays in the consumer so only the involved
 * nodes are read.
 */
export const useOverlayMeasure = (
  watched: (Element | null | undefined)[],
  deps: React.DependencyList = [],
): number => {
  const [tick, force] = React.useReducer((n: number) => (n + 1) % 1_000_000, 0);

  // Scroll / resize: coalesce to ONE re-measure per animation frame. A raw
  // listener fires `force()` (a state update → overlay re-render) on every
  // scroll event — dozens per second while scrolling — which visibly janks the
  // canvas. rAF-throttling caps it at the frame rate with no loss in accuracy.
  React.useEffect(() => {
    let raf = 0;
    const onChange = (): void => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        force();
      });
    };
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  // ResizeObserver on the currently-watched elements only. `watched` can change
  // length between renders (e.g. selection gains/loses siblings), so it must NOT
  // be spread as the dependency array — React requires a constant-size deps list
  // ("The final argument passed to useEffect changed size between renders").
  // Instead we key the effect on a stable per-element identity signature.
  const idMap = React.useRef(new WeakMap<Element, number>());
  const idSeq = React.useRef(0);
  const watchedRef = React.useRef(watched);
  watchedRef.current = watched;

  const signature = watched
    .map((el) => {
      if (!el) return "_";
      let id = idMap.current.get(el);
      if (id === undefined) {
        id = (idSeq.current += 1);
        idMap.current.set(el, id);
      }
      return String(id);
    })
    .join(",");

  React.useEffect(() => {
    const els = watchedRef.current.filter((e): e is Element => !!e);
    if (els.length === 0) return;
    const ro = new ResizeObserver(() => force());
    for (const el of els) ro.observe(el);
    return () => ro.disconnect();
  }, [signature]);

  // Force a measure on the frame after a tree/prop change settled.
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => force());
    return () => cancelAnimationFrame(raf);
  }, deps);

  return tick;
};

/** rAF-throttled callback runner for drag loops (coalesces pointermove). */
export const useRafThrottle = (): {
  schedule: (fn: () => void) => void;
  cancel: () => void;
} => {
  const raf = React.useRef<number | null>(null);
  const pending = React.useRef<(() => void) | null>(null);

  const cancel = React.useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    pending.current = null;
  }, []);

  const schedule = React.useCallback((fn: () => void) => {
    pending.current = fn;
    if (raf.current != null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const job = pending.current;
      pending.current = null;
      job?.();
    });
  }, []);

  React.useEffect(() => cancel, [cancel]);

  return { schedule, cancel };
};

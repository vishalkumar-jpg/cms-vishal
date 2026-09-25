"use client";

import * as React from "react";
import type { StyleBreakpoint } from "@ob-cms/block-schema";

const StyleBreakpointContext = React.createContext<StyleBreakpoint | undefined>(undefined);

/**
 * Synchronous preview breakpoint for style resolution during React render.
 *
 * The builder / draft preview set this via `OBStyleBreakpointProvider` (from
 * `OBSiteRoot`'s `breakpoint` prop). `cssFromStyles()` reads it so blocks render
 * with breakpoint-resolved inline styles instead of relying on CSS-var activation
 * rules that only apply in some preview contexts.
 *
 * On the published site, `OBSiteRoot breakpointSource="container"` sets this from
 * the authored-style breakpoint (which may differ from `data-ob-breakpoint` when
 * the container label is `desktop` but width is below the largeDesktop band).
 * SSR renders desktop first; the client corrects before paint via
 * `useLayoutEffect`. Other hosts leave the ref unset.
 */
export const styleBreakpointRef: { current: StyleBreakpoint | undefined } = {
  current: undefined,
};

/** Subscribe to the active authored-style breakpoint (published container or preview). */
export function useOBStyleBreakpoint(): StyleBreakpoint | undefined {
  return React.useContext(StyleBreakpointContext);
}

export function OBStyleBreakpointProvider({
  value,
  children,
}: {
  value?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const bp = value as StyleBreakpoint | undefined;
  styleBreakpointRef.current = bp;
  React.useEffect(() => {
    return () => {
      if (styleBreakpointRef.current === bp) {
        styleBreakpointRef.current = undefined;
      }
    };
  }, [bp]);
  return (
    <StyleBreakpointContext.Provider value={bp}>{children}</StyleBreakpointContext.Provider>
  );
}

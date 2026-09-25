"use client";

import * as React from "react";

export type OBViewportMode = "mobile" | "tablet" | "desktop";

const OBViewportContext = React.createContext<OBViewportMode | undefined>(undefined);

export function OBViewportProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value?: OBViewportMode;
}): React.ReactElement {
  return <OBViewportContext.Provider value={value}>{children}</OBViewportContext.Provider>;
}

/** Current builder preview bucket (from OBSiteRoot). Undefined on live published pages. */
export function useOBViewport(): OBViewportMode | undefined {
  return React.useContext(OBViewportContext);
}

export function isNarrowViewport(vp?: OBViewportMode): boolean {
  return vp === "mobile" || vp === "tablet";
}

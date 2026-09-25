"use client";

import * as React from "react";

/** True when a Column sits inside a Grid that becomes a mobile swipe carousel. */
export const MobileCarouselParentContext = React.createContext(false);

export function MobileCarouselParentProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: boolean;
}): React.ReactElement {
  return (
    <MobileCarouselParentContext.Provider value={value}>
      {children}
    </MobileCarouselParentContext.Provider>
  );
}

export function useInMobileCarousel(): boolean {
  return React.useContext(MobileCarouselParentContext);
}

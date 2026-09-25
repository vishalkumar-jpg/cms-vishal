"use client";

import * as React from "react";

/** Set by Row/Group when children should stay side-by-side on narrow viewports. */
export const RowLayoutContext = React.createContext<"row" | "column" | null>(null);

export const useRowLayout = (): "row" | "column" | null => React.useContext(RowLayoutContext);

"use client";

import * as React from "react";
import type { BlockComponent } from "./registry";
import { useOBStyleBreakpoint } from "./style-breakpoint-context";

/** Re-render a registry block when authored-style breakpoint context changes. */
export function StyleBreakpointBlock({
  component: Component,
  children,
  ...props
}: {
  component?: BlockComponent;
  children?: React.ReactNode;
} & Record<string, unknown>): React.ReactElement {
  const bp = useOBStyleBreakpoint();
  if (Component) {
    return (
      <Component {...props}>{children}</Component>
    );
  }
  return (
    <React.Fragment key={bp}>
      {children}
    </React.Fragment>
  );
}

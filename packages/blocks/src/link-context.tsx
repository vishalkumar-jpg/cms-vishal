"use client";

import * as React from "react";

/** Props for framework-provided internal link components (e.g. next/link). */
export type InternalLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children?: React.ReactNode;
};

export type LinkComponentType = React.ForwardRefExoticComponent<
  InternalLinkProps & React.RefAttributes<HTMLAnchorElement>
>;

const LinkRenderContext = React.createContext<LinkComponentType | null>(null);

/**
 * Optional link renderer injected by the host app. When set, `SafeLink` uses it
 * for same-origin relative URLs so the published site can do client-side nav
 * (Next.js `Link`) without adding a framework dependency to `@ob-cms/blocks`.
 */
export function LinkRenderProvider({
  linkComponent,
  children,
}: {
  linkComponent: LinkComponentType | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <LinkRenderContext.Provider value={linkComponent}>{children}</LinkRenderContext.Provider>
  );
}

export function useLinkComponent(): LinkComponentType | null {
  return React.useContext(LinkRenderContext);
}

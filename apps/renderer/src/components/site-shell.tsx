"use client";

import * as React from "react";
import { LinkRenderProvider } from "@ob-cms/blocks";
import { LiveReusableBlockProvider } from "@/components/reusable-block-provider";
import { LiveCollectionProvider } from "@/components/collection-provider";
import { CmsLink } from "./cms-link";

/**
 * Root shell for the published site: client-side navigation for block links plus
 * reusable-block / collection runtimes for every page (including global chrome).
 */
export function SiteShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <LinkRenderProvider linkComponent={CmsLink}>
      <LiveCollectionProvider>
        <LiveReusableBlockProvider>{children}</LiveReusableBlockProvider>
      </LiveCollectionProvider>
    </LinkRenderProvider>
  );
}

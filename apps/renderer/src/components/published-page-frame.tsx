import * as React from "react";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { RenderLayout, blockRegistry, OBSiteRootBreakpointSources } from "@ob-cms/blocks";
import type { RenderEnv } from "@ob-cms/blocks";

import type { NavItem } from "@/lib/public-api-types";
import {
  composePublishedPageLayout,
  hasBlockGlobalChrome,
} from "@/lib/compose-published-page-layout";
import { SiteFooter, SiteHeader } from "@/components/site-navigation";

export type PublishedPageFrameProps = {
  pageLayout: SerializedLayout;
  headerLayout?: SerializedLayout | null;
  footerLayout?: SerializedLayout | null;
  headerNav?: NavItem[];
  footerNav?: NavItem[];
  env?: RenderEnv;
  manageCookies?: boolean;
  mainClassName?: string;
  children?: React.ReactNode;
};

/**
 * Published-site page shell aligned with admin draft preview: one merged layout
 * tree rendered through a single `RenderLayout` / `OBSiteRoot`. Legacy JSON nav
 * is shown only when no block-based global chrome is configured.
 */
export function PublishedPageFrame({
  pageLayout,
  headerLayout = null,
  footerLayout = null,
  headerNav = [],
  footerNav = [],
  env,
  manageCookies = false,
  mainClassName,
  children,
}: PublishedPageFrameProps): React.ReactElement {
  const composedLayout = composePublishedPageLayout(pageLayout, headerLayout, footerLayout);
  const blockChrome = hasBlockGlobalChrome(headerLayout, footerLayout);

  return (
    <>
      {!blockChrome && <SiteHeader items={headerNav} />}
      <main className={mainClassName}>
        {children ?? (
          <RenderLayout
            data={composedLayout}
            blocks={blockRegistry}
            breakpointSource={OBSiteRootBreakpointSources.container}
            env={env}
          />
        )}
      </main>
      {(!blockChrome || manageCookies) && (
        <SiteFooter
          items={blockChrome ? [] : footerNav}
          manageCookies={manageCookies}
        />
      )}
    </>
  );
}

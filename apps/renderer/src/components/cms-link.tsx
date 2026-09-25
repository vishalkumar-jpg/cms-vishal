"use client";

import * as React from "react";
import NextLink from "next/link";
import type { InternalLinkProps } from "@ob-cms/blocks/link-context";

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function isSpecialHref(href: string): boolean {
  return href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:");
}

/**
 * Next.js client link for same-origin CMS pages. External URLs and hash/mailto
 * links stay as plain anchors (full navigation where appropriate).
 */
export const CmsLink = React.forwardRef<HTMLAnchorElement, InternalLinkProps>(
  function CmsLink({ href, children, target, rel, ...rest }, ref) {
    if (isExternalHref(href) || isSpecialHref(href) || target === "_blank") {
      const safeRel = target === "_blank" || isExternalHref(href) ? rel || "noopener noreferrer" : rel;
      return (
        <a ref={ref} href={href} target={target} rel={safeRel} {...rest}>
          {children}
        </a>
      );
    }

    return (
      <NextLink ref={ref} href={href} rel={rel} prefetch={false} {...rest}>
        {children}
      </NextLink>
    );
  },
);

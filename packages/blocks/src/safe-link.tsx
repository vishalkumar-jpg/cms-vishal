"use client";

import * as React from "react";
import { sanitizeUrl } from "@ob-cms/block-schema";
import { useLinkComponent } from "./link-context";

export interface SafeLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  url?: string;
  children?: React.ReactNode;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function isSpecialHref(href: string): boolean {
  return (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  );
}

/**
 * SSR-safe anchor. Sanitizes the URL and uses an injected link component (when
 * the host provides one via `LinkRenderProvider`) for same-origin navigation.
 */
export const SafeLink = React.forwardRef<HTMLAnchorElement, SafeLinkProps>(
  function SafeLink({ url, children, target, rel, ...rest }, ref) {
    const href = sanitizeUrl(url) || "#";
    const isExternal = isExternalHref(href);
    const safeRel = target === "_blank" || isExternal ? rel || "noopener noreferrer" : rel;
    const LinkComp = useLinkComponent();

    if (
      LinkComp &&
      !isExternal &&
      !isSpecialHref(href) &&
      href !== "#" &&
      target !== "_blank"
    ) {
      return (
        <LinkComp ref={ref} href={href} target={target} rel={safeRel} {...rest}>
          {children}
        </LinkComp>
      );
    }

    return (
      <a ref={ref} href={href} target={target} rel={safeRel} {...rest}>
        {children}
      </a>
    );
  },
);

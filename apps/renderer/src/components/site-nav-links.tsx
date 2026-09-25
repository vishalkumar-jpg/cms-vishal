"use client";

import * as React from "react";
import { SafeLink } from "@ob-cms/blocks";
import type { NavItem } from "@/lib/public-api-types";

export function SiteNavLinks({ items }: { items: NavItem[] }): React.ReactElement {
  return (
    <ul className="flex flex-wrap items-center gap-4">
      {items.map((item, i) => (
        <li key={`${item.href}-${i}`}>
          <SafeLink
            url={item.href}
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--color-nav-text, inherit)" }}
          >
            {item.label}
          </SafeLink>
        </li>
      ))}
    </ul>
  );
}

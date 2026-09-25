import * as React from "react";
import { Link } from "react-router";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  MY_TEMPLATES_TAB_LABEL,
  TEMPLATE_LIBRARY_BROWSE_STARTERS_LABEL,
  TEMPLATE_LIBRARY_ROUTES,
} from "@/views/template-library/constants";

export const builderTemplateLibraryNavLinks = (): ReadonlyArray<{
  to: string;
  label: string;
}> => [
  { to: TEMPLATE_LIBRARY_ROUTES.mine, label: MY_TEMPLATES_TAB_LABEL },
  { to: TEMPLATE_LIBRARY_ROUTES.starters, label: TEMPLATE_LIBRARY_BROWSE_STARTERS_LABEL },
];

/** Plain router links — used by tests and the builder overflow menu. */
export const BuilderToolbarTemplateNavLinks: React.FC = () => (
  <>
    {builderTemplateLibraryNavLinks().map(({ to, label }) => (
      <Link key={to} to={to}>
        {label}
      </Link>
    ))}
  </>
);

/** Template library links in the builder overflow menu. */
export const BuilderToolbarTemplateMenuLinks: React.FC = () => (
  <>
    {builderTemplateLibraryNavLinks().map(({ to, label }) => (
      <DropdownMenuItem key={to} asChild>
        <Link to={to}>{label}</Link>
      </DropdownMenuItem>
    ))}
    <DropdownMenuSeparator />
  </>
);

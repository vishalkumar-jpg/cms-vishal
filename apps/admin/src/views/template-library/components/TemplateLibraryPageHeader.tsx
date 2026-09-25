import * as React from "react";
import { Hammer, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import type { TemplateLibraryTab } from "../lib/templateLibraryTab";
import {
  TEMPLATE_LIBRARY_CREATE_BLANK_PAGE_LABEL,
  TEMPLATE_LIBRARY_OPEN_BUILDER_LABEL,
  TEMPLATE_LIBRARY_TITLE,
} from "../constants";

export type TemplateLibraryPageHeaderProps = {
  activeTab: TemplateLibraryTab;
  siteSelected: boolean;
  onCreateBlankPage: () => void;
  onOpenBuilder: () => void;
};

/** Page title and tab-specific primary action for the Template Library. */
export const TemplateLibraryPageHeader: React.FC<TemplateLibraryPageHeaderProps> = ({
  activeTab,
  siteSelected,
  onCreateBlankPage,
  onOpenBuilder,
}) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold">{TEMPLATE_LIBRARY_TITLE}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Browse platform starters and layouts saved from your builder.
      </p>
    </div>
    {siteSelected ? (
      activeTab === "starter" ? (
        <Button
          type="button"
          className="w-full shrink-0 sm:w-auto"
          onClick={onCreateBlankPage}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {TEMPLATE_LIBRARY_CREATE_BLANK_PAGE_LABEL}
        </Button>
      ) : (
        <Button
          type="button"
          className="w-full shrink-0 sm:w-auto"
          onClick={onOpenBuilder}
        >
          <Hammer className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {TEMPLATE_LIBRARY_OPEN_BUILDER_LABEL}
        </Button>
      )
    ) : null}
  </div>
);

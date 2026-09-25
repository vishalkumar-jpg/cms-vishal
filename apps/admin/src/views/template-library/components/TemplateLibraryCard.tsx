import * as React from "react";
import type { TemplateCatalogEntry } from "@/views/template-catalog/types";
import type { TemplateLibraryItem, TemplateLibraryMineItem } from "../types";
import { TemplateLibraryMineCard } from "./TemplateLibraryMineCard";
import { TemplateLibraryStarterCard } from "./TemplateLibraryStarterCard";

export type TemplateLibraryCardProps = {
  item: TemplateLibraryItem;
  usageCount?: number;
  onStarterPreview?: (entry: TemplateCatalogEntry) => void;
  onStarterUseTemplate?: (entry: TemplateCatalogEntry) => void;
  onMinePreview?: (item: TemplateLibraryMineItem) => void;
  onMineRename?: (item: TemplateLibraryMineItem) => void;
  onMineDuplicate?: (item: TemplateLibraryMineItem) => void;
  onMineDelete?: (item: TemplateLibraryMineItem) => void;
  onMineOpenBuilder?: () => void;
};

/** Routes a library item to the correct source-specific card. */
export const TemplateLibraryCard: React.FC<TemplateLibraryCardProps> = ({
  item,
  usageCount,
  onStarterPreview,
  onStarterUseTemplate,
  onMinePreview,
  onMineRename,
  onMineDuplicate,
  onMineDelete,
  onMineOpenBuilder,
}) => {
  if (item.source === "starter") {
    return (
      <TemplateLibraryStarterCard
        entry={item.sourceData}
        usageCount={usageCount}
        onPreview={onStarterPreview}
        onUseTemplate={onStarterUseTemplate}
      />
    );
  }

  return (
    <TemplateLibraryMineCard
      item={item}
      onPreview={onMinePreview}
      onRename={onMineRename}
      onDuplicate={onMineDuplicate}
      onDelete={onMineDelete}
      onOpenBuilder={onMineOpenBuilder}
    />
  );
};

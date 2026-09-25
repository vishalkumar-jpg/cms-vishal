import * as React from "react";
import type { TemplateCatalogEntry } from "@/views/template-catalog/types";
import { TEMPLATE_LIBRARY_FEATURED_SHELF_TITLE } from "../constants";
import { TemplateLibraryStarterCard } from "./TemplateLibraryStarterCard";

export type TemplateLibraryFeaturedRowProps = {
  entries: TemplateCatalogEntry[];
  usageByTemplateKey?: Map<string, number>;
  onPreview?: (entry: TemplateCatalogEntry) => void;
  onUseTemplate?: (entry: TemplateCatalogEntry) => void;
};

/** Horizontal featured starters — hidden when search/filters are active. */
export const TemplateLibraryFeaturedRow: React.FC<TemplateLibraryFeaturedRowProps> = ({
  entries,
  usageByTemplateKey,
  onPreview,
  onUseTemplate,
}) => {
  const featured = entries.filter((entry) => entry.featured);
  if (featured.length === 0) return null;

  return (
    <section className="mb-8" aria-label={TEMPLATE_LIBRARY_FEATURED_SHELF_TITLE}>
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
        {TEMPLATE_LIBRARY_FEATURED_SHELF_TITLE}
      </h2>
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 snap-x snap-mandatory">
        {featured.map((entry) => (
          <div
            key={entry.id}
            className="w-[min(100%,280px)] shrink-0 snap-start sm:w-[280px]"
          >
            <TemplateLibraryStarterCard
              entry={entry}
              usageCount={usageByTemplateKey?.get(entry.templateKey)}
              onPreview={onPreview}
              onUseTemplate={onUseTemplate}
              compact
            />
          </div>
        ))}
      </div>
    </section>
  );
};

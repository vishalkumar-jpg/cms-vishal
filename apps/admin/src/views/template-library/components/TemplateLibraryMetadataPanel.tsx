import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  METADATA_LABEL,
  STARTER_PREVIEW_METADATA_HINT,
} from "@/views/template-catalog/lib/catalogLabels";
import { TEMPLATE_LIBRARY_FEATURED_FILTER_LABEL } from "@/views/template-library/constants";

export type TemplateLibraryMetadataField = {
  label: string;
  value: React.ReactNode;
};

export type TemplateLibraryMetadataPanelProps = {
  fields: TemplateLibraryMetadataField[];
  tags?: string[];
  hint?: string;
  featured?: boolean;
};

/** Shared metadata grid for starter and mine preview dialogs. */
export const TemplateLibraryMetadataPanel: React.FC<TemplateLibraryMetadataPanelProps> = ({
  fields,
  tags,
  hint = STARTER_PREVIEW_METADATA_HINT,
  featured,
}) => (
  <div className="flex flex-col gap-4">
    {featured ? (
      <Badge variant="default" className="w-fit">
        {TEMPLATE_LIBRARY_FEATURED_FILTER_LABEL}
      </Badge>
    ) : null}
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col gap-1">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {field.label}
          </dt>
          <dd className="text-foreground">{field.value}</dd>
        </div>
      ))}
    </dl>
    {tags && tags.length > 0 ? (
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {METADATA_LABEL.tags}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="muted">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    ) : null}
    {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
  </div>
);

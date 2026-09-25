import * as React from "react";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TemplateLivePreviewHero } from "@/views/template-library/components/TemplateLivePreviewHero";
import {
  CATEGORY_LABEL,
  METADATA_LABEL,
  PUBLISHED_STARTER_ONLY_HINT,
  STATUS_LABEL,
  STATUS_VARIANT,
  USE_STARTER_TEMPLATE_LABEL,
} from "../lib/catalogLabels";
import { canUseTemplate, hasPreviewTags, previewDescription } from "../lib/templatePreview";
import type { TemplateCatalogEntry } from "../types";
import { TemplateLibraryMetadataPanel } from "@/views/template-library/components/TemplateLibraryMetadataPanel";
import {
  formatPageTypes,
  formatPreviewDate,
  templateKeyLabel,
} from "@/views/template-library/lib/formatLibraryMetadata";

export type TemplatePreviewDialogProps = {
  template: TemplateCatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the existing Use Template dialog — no create logic here. */
  onUseTemplate?: (template: TemplateCatalogEntry) => void;
};

/**
 * Catalog preview — live layout render + starter metadata.
 * Instantiation stays in UseTemplateDialog.
 */
export const TemplatePreviewDialog: React.FC<TemplatePreviewDialogProps> = ({
  template,
  open,
  onOpenChange,
  onUseTemplate,
}) => {
  const canUse = template ? canUseTemplate(template.status) : false;
  const description = previewDescription(template?.description);
  const showTags = hasPreviewTags(template?.tags);
  const showStatus = template && template.status !== "published";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        {template ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {open ? (
              <TemplateLivePreviewHero
                templateKey={template.templateKey}
                starterEntry={template}
                label={`${template.displayName} layout preview`}
              />
            ) : null}

            <div className="flex flex-col gap-4 p-4 sm:p-6">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-xl">{template.displayName}</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  {description}
                </DialogDescription>
              </DialogHeader>

              <TemplateLibraryMetadataPanel
                featured={template.featured}
                tags={showTags ? template.tags : undefined}
                fields={[
                  {
                    label: METADATA_LABEL.category,
                    value: (
                      <Badge variant="secondary">
                        {CATEGORY_LABEL[template.category] ?? template.category}
                      </Badge>
                    ),
                  },
                  ...(showStatus
                    ? [
                        {
                          label: METADATA_LABEL.status,
                          value: (
                            <Badge variant={STATUS_VARIANT[template.status]}>
                              {STATUS_LABEL[template.status] ?? template.status}
                            </Badge>
                          ),
                        },
                      ]
                    : []),
                  {
                    label: METADATA_LABEL.updated,
                    value: formatPreviewDate(template.updatedAt),
                  },
                  {
                    label: METADATA_LABEL.templateKey,
                    value: (
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {templateKeyLabel(template.templateKey)}
                      </code>
                    ),
                  },
                  {
                    label: METADATA_LABEL.version,
                    value: template.version,
                  },
                  {
                    label: METADATA_LABEL.pageTypes,
                    value: formatPageTypes(template.supportedPageTypes),
                  },
                ]}
              />
            </div>
          </div>
        ) : (
          <DialogHeader className="p-6">
            <DialogTitle>Starter Template preview</DialogTitle>
          </DialogHeader>
        )}

        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border bg-muted/20 px-4 py-4 sm:flex-row sm:px-6">
          {!canUse && template ? (
            <p
              id="template-preview-use-hint"
              className="w-full text-[11px] leading-snug text-muted-foreground sm:order-first sm:flex-1"
            >
              {PUBLISHED_STARTER_ONLY_HINT}
            </p>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={!template || !canUse}
            aria-describedby={!canUse && template ? "template-preview-use-hint" : undefined}
            onClick={() => {
              if (!template || !canUse) return;
              onOpenChange(false);
              onUseTemplate?.(template);
            }}
          >
            {USE_STARTER_TEMPLATE_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

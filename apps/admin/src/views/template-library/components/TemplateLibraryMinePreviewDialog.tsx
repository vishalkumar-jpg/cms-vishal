import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TemplateLivePreviewHero } from "./TemplateLivePreviewHero";
import { METADATA_LABEL } from "@/views/template-catalog/lib/catalogLabels";
import {
  formatPreviewDate,
  templateKeyLabel,
} from "@/views/template-library/lib/formatLibraryMetadata";
import type { TemplateLibraryMineItem } from "../types";
import {
  INSERT_IN_BUILDER_LABEL,
  MINE_PREVIEW_LAYOUT_HINT,
  templateKindLabel,
} from "../constants";
import { TemplateLibraryMetadataPanel } from "./TemplateLibraryMetadataPanel";

export type TemplateLibraryMinePreviewDialogProps = {
  item: TemplateLibraryMineItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenBuilder?: () => void;
};

/** Live read-only preview for saved templates — page and section kinds. */
export const TemplateLibraryMinePreviewDialog: React.FC<
  TemplateLibraryMinePreviewDialogProps
> = ({ item, open, onOpenChange, onOpenBuilder }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        {item ? (
          <>
            {open ? (
              <TemplateLivePreviewHero
                layout={item.sourceData.layout}
                mineKind={item.metadata.kind}
                label={`${item.title} layout preview`}
              />
            ) : null}
            <div className="flex flex-col gap-4 overflow-y-auto p-4 sm:p-6">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-xl">{item.title}</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  {item.description}
                </DialogDescription>
              </DialogHeader>
              <TemplateLibraryMetadataPanel
                hint={MINE_PREVIEW_LAYOUT_HINT}
                fields={[
                  {
                    label: METADATA_LABEL.kind,
                    value: (
                      <Badge variant="secondary">{templateKindLabel(item.metadata.kind)}</Badge>
                    ),
                  },
                  {
                    label: METADATA_LABEL.created,
                    value: formatPreviewDate(item.metadata.createdAt),
                  },
                  {
                    label: METADATA_LABEL.updated,
                    value: formatPreviewDate(item.metadata.updatedAt),
                  },
                  {
                    label: "Template id",
                    value: (
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {templateKeyLabel(item.id)}
                      </code>
                    ),
                  },
                ]}
              />
            </div>
          </>
        ) : (
          <DialogHeader className="p-6">
            <DialogTitle>My Template preview</DialogTitle>
            <DialogDescription>No template selected.</DialogDescription>
          </DialogHeader>
        )}
        <DialogFooter className="shrink-0 border-t border-border bg-muted/20 px-4 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={!item}
            onClick={() => {
              onOpenChange(false);
              onOpenBuilder?.();
            }}
          >
            {INSERT_IN_BUILDER_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
);

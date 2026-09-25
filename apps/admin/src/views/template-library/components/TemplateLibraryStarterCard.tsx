import * as React from "react";
import { Link } from "react-router";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import {
  copyTextToClipboard,
  starterTemplateMenuItems,
  type StarterTemplateMenuAction,
} from "@/views/template-catalog/lib/catalogActions";
import {
  CATEGORY_LABEL,
  PUBLISHED_STARTER_ONLY_HINT,
  USE_STARTER_TEMPLATE_LABEL,
} from "@/views/template-catalog/lib/catalogLabels";
import { canUseTemplate, previewDescription } from "@/views/template-catalog/lib/templatePreview";
import type { TemplateCatalogEntry } from "@/views/template-catalog/types";
import { TEMPLATE_LIBRARY_FEATURED_FILTER_LABEL } from "../constants";
import {
  formatUpdatedDate,
  starterCardTagLimit,
  summarizeTags,
} from "../lib/formatLibraryMetadata";
import { formatStarterUsageLabel } from "../lib/formatTemplateUsage";
import { TemplateLibraryCardShell } from "./TemplateLibraryCardShell";
import { TemplateThumbnail } from "./TemplateThumbnail";

/** Starter template card for Template Library (and featured shelf). */
export const TemplateLibraryStarterCard: React.FC<{
  entry: TemplateCatalogEntry;
  onPreview?: (entry: TemplateCatalogEntry) => void;
  onUseTemplate?: (entry: TemplateCatalogEntry) => void;
  /** Site-scoped page count from usage analytics. */
  usageCount?: number;
  /** Slightly tighter footer when rendered in the featured shelf. */
  compact?: boolean;
}> = ({ entry, onPreview, onUseTemplate, usageCount, compact = false }) => {
  const canUse = canUseTemplate(entry.status);
  const description = previewDescription(entry.description);
  const menuItems = starterTemplateMenuItems(canUse);
  const { visible: visibleTags, overflow: tagOverflow } = summarizeTags(
    entry.tags,
    starterCardTagLimit(compact),
  );
  const showStatusBadge = entry.status !== "published";
  const usageLabel = formatStarterUsageLabel(usageCount);

  const runMenuAction = async (action: StarterTemplateMenuAction): Promise<void> => {
    switch (action) {
      case "preview":
        onPreview?.(entry);
        return;
      case "details":
        return;
      case "use":
        if (!canUse) return;
        onUseTemplate?.(entry);
        return;
      case "copyKey": {
        const ok = await copyTextToClipboard(entry.templateKey);
        if (ok) toast.success("Template key copied");
        else toast.error("Could not copy template key");
        return;
      }
      case "copyId": {
        const ok = await copyTextToClipboard(entry.id);
        if (ok) toast.success("Template ID copied");
        else toast.error("Could not copy template ID");
        return;
      }
    }
  };

  return (
    <TemplateLibraryCardShell
      compact={compact}
      title={entry.displayName}
      titleId={`template-card-title-${entry.id}`}
      description={description}
      image={
        <TemplateThumbnail
          label={`${entry.displayName} thumbnail`}
          templateKey={entry.templateKey}
          starterEntry={entry}
          compact={compact}
        />
      }
      imageOverlay={
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          {entry.featured ? (
            <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
              {TEMPLATE_LIBRARY_FEATURED_FILTER_LABEL}
            </span>
          ) : null}
        </>
      }
      overflowMenu={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className={compact ? "h-7 w-7 bg-background/90 shadow-sm" : "h-8 w-8 bg-background/90 shadow-sm"}
              aria-label={`More actions for ${entry.displayName}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menuItems.map((item) => (
              <DropdownMenuItem
                key={item.action}
                disabled={item.disabled}
                aria-describedby={
                  item.action === "use" && item.disabled ? `use-template-hint-${entry.id}` : undefined
                }
                asChild={item.action === "details"}
                onClick={item.action === "details" ? undefined : () => void runMenuAction(item.action)}
              >
                {item.action === "details" ? (
                  <Link to={`/template-library/starter/${entry.id}`}>{item.label}</Link>
                ) : (
                  item.label
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
      badges={
        <>
          <Badge variant="secondary">{CATEGORY_LABEL[entry.category] ?? entry.category}</Badge>
          {showStatusBadge ? (
            <Badge variant="outline">{entry.status}</Badge>
          ) : null}
          {visibleTags.map((tag) => (
            <Badge key={tag} variant="muted" className="font-normal">
              {tag}
            </Badge>
          ))}
          {tagOverflow > 0 ? (
            <Badge variant="muted" className="font-normal">
              +{tagOverflow}
            </Badge>
          ) : null}
        </>
      }
      metadata={
        compact ? (
          usageLabel ? (
            <span className="text-[11px] text-muted-foreground">{usageLabel}</span>
          ) : undefined
        ) : (
          <span className="flex flex-col gap-0.5">
            <span>Updated {formatUpdatedDate(entry.updatedAt)}</span>
            {usageLabel ? (
              <span className="text-[11px] text-muted-foreground">{usageLabel}</span>
            ) : null}
          </span>
        )
      }
      footer={
        <>
          <div className={`flex gap-1.5 ${compact ? "flex-row" : "flex-col sm:flex-row"}`}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`w-full ${compact ? "h-8 flex-1 text-xs" : "sm:flex-1"}`}
              onClick={() => onPreview?.(entry)}
            >
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              className={`w-full ${compact ? "h-8 flex-1 text-xs" : "sm:flex-1"}`}
              disabled={!canUse}
              aria-describedby={!canUse ? `use-template-hint-${entry.id}` : undefined}
              onClick={() => {
                if (!canUse) return;
                onUseTemplate?.(entry);
              }}
            >
              {USE_STARTER_TEMPLATE_LABEL}
            </Button>
          </div>
          {!canUse ? (
            <p
              id={`use-template-hint-${entry.id}`}
              className={
                compact
                  ? "sr-only"
                  : "text-[11px] leading-snug text-muted-foreground"
              }
            >
              {PUBLISHED_STARTER_ONLY_HINT}
            </p>
          ) : null}
        </>
      }
    />
  );
};

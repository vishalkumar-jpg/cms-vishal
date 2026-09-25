import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  mineTemplateMenuItems,
  type MineTemplateMenuAction,
} from "../lib/mineTemplateActions";
import {
  INSERT_IN_BUILDER_LABEL,
  MINE_CARD_RENAME_HINT,
  templateKindLabel,
} from "../constants";
import { formatUpdatedDate } from "../lib/formatLibraryMetadata";
import type { TemplateLibraryMineItem } from "../types";
import { TemplateLibraryCardShell } from "./TemplateLibraryCardShell";
import { TemplateThumbnail } from "./TemplateThumbnail";

/** Saved template card with library management actions. */
export const TemplateLibraryMineCard: React.FC<{
  item: TemplateLibraryMineItem;
  onPreview?: (item: TemplateLibraryMineItem) => void;
  onRename?: (item: TemplateLibraryMineItem) => void;
  onDuplicate?: (item: TemplateLibraryMineItem) => void;
  onDelete?: (item: TemplateLibraryMineItem) => void;
  onOpenBuilder?: () => void;
}> = ({ item, onPreview, onRename, onDuplicate, onDelete, onOpenBuilder }) => {
  const canManage = item.metadata.canManage;
  const menuItems = mineTemplateMenuItems();

  const runMenuAction = (action: MineTemplateMenuAction): void => {
    switch (action) {
      case "preview":
        onPreview?.(item);
        return;
      case "rename":
        onRename?.(item);
        return;
      case "duplicate":
        onDuplicate?.(item);
        return;
      case "delete":
        onDelete?.(item);
        return;
    }
  };

  return (
    <TemplateLibraryCardShell
      title={item.title}
      titleId={`mine-template-card-title-${item.id}`}
      description={item.description}
      image={
        <TemplateThumbnail
          label={`${item.title} thumbnail`}
          layout={item.sourceData.layout}
          mineKind={item.metadata.kind}
        />
      }
      overflowMenu={
        canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8 bg-background/90 text-foreground shadow-sm"
                aria-label={`More actions for ${item.title}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menuItems.map((menuItem) => (
                <DropdownMenuItem
                  key={menuItem.action}
                  className={
                    menuItem.destructive ? "text-destructive focus:text-destructive" : undefined
                  }
                  onClick={() => runMenuAction(menuItem.action)}
                >
                  {menuItem.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined
      }
      badges={<Badge variant="secondary">{templateKindLabel(item.metadata.kind)}</Badge>}
      metadata={<span>Updated {formatUpdatedDate(item.metadata.updatedAt)}</span>}
      footer={
        <>
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:flex-1"
              onClick={() => onPreview?.(item)}
            >
              Preview
            </Button>
            <Button type="button" size="sm" className="w-full sm:flex-1" onClick={onOpenBuilder}>
              {INSERT_IN_BUILDER_LABEL}
            </Button>
          </div>
          {canManage ? (
            <p className="text-[11px] leading-snug text-muted-foreground">{MINE_CARD_RENAME_HINT}</p>
          ) : null}
        </>
      }
    />
  );
};

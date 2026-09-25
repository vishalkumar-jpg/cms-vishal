import * as React from "react";
import { ImageIcon, FileVideo, FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MediaItem } from "../types";

/** Thumbnail tile for a media item; falls back to a type icon for non-images. */
export const MediaTile: React.FC<{
  item: MediaItem;
  selected?: boolean;
  draggable?: boolean;
  onClick?: () => void;
}> = ({ item, selected, draggable, onClick }) => {
  const isImage = item.type.startsWith("image/");
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={
        draggable ? (e) => e.dataTransfer.setData("text/media-id", item.id) : undefined
      }
      onClick={onClick}
      className={cn(
        "group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-lg border bg-muted/30 text-muted-foreground transition-all",
        selected
          ? "border-primary ring-2 ring-primary"
          : "border-border hover:border-primary/50 hover:shadow-sm",
      )}
      title={item.alt ?? item.storageKey}
    >
      {isImage && item.url ? (
        <img
          src={item.url}
          alt={item.alt ?? ""}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : item.type.startsWith("video/") ? (
        <FileVideo className="h-8 w-8" />
      ) : (
        <FileText className="h-8 w-8" />
      )}
      {item.status !== "ready" && (
        <span className="absolute right-1 top-1 rounded bg-amber-500/90 px-1 text-[10px] font-medium text-white">
          {item.status}
        </span>
      )}
    </button>
  );
};

/** Responsive grid of media tiles with empty/loading states. */
export const MediaGrid: React.FC<{
  items: MediaItem[];
  isLoading?: boolean;
  selectedId?: string | null;
  draggable?: boolean;
  onItemClick: (item: MediaItem) => void;
  emptyText?: string;
}> = ({ items, isLoading, selectedId, draggable, onItemClick, emptyText = "No media yet." }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
        <ImageIcon className="h-8 w-8 opacity-40" />
        {emptyText}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {items.map((item) => (
        <MediaTile
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          draggable={draggable}
          onClick={() => onItemClick(item)}
        />
      ))}
    </div>
  );
};

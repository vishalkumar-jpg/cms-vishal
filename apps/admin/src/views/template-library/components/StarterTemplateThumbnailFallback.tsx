import * as React from "react";
import { LayoutTemplate } from "lucide-react";
import type { TemplateCatalogEntry } from "@/views/template-catalog/types";
import {
  hasPreviewThumbnail,
  previewCoverUrl,
  previewThumbnailUrl,
} from "@/views/template-catalog/lib/templatePreview";

/** Static SVG fallback chain for starter templates (thumb → cover → icon). */
export const StarterTemplateThumbnailFallback: React.FC<{
  entry: Pick<TemplateCatalogEntry, "templateKey" | "thumbnail">;
  compact?: boolean;
}> = ({ entry, compact = false }) => {
  const [failedThumb, setFailedThumb] = React.useState<string | null>(null);
  const [failedCover, setFailedCover] = React.useState<string | null>(null);

  const thumbSrc = previewThumbnailUrl(entry);
  const coverSrc = previewCoverUrl(entry.templateKey);
  const showThumb = hasPreviewThumbnail(thumbSrc) && thumbSrc !== failedThumb;
  const showCover = !showThumb && coverSrc !== failedCover;

  if (showThumb) {
    return (
      <img
        src={thumbSrc}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover object-top"
        onError={() => setFailedThumb(thumbSrc ?? null)}
      />
    );
  }

  if (showCover) {
    return (
      <img
        src={coverSrc}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover object-top"
        onError={() => setFailedCover(coverSrc)}
      />
    );
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center text-muted-foreground"
      aria-hidden="true"
      data-testid="starter-template-thumbnail-fallback"
    >
      <LayoutTemplate className={compact ? "h-8 w-8 opacity-40" : "h-10 w-10 opacity-40"} />
    </div>
  );
};

import * as React from "react";

export type TemplateLibraryCardShellProps = {
  image: React.ReactNode;
  imageOverlay?: React.ReactNode;
  overflowMenu?: React.ReactNode;
  badges?: React.ReactNode;
  title: string;
  titleId: string;
  description: string;
  metadata?: React.ReactNode;
  footer: React.ReactNode;
  /** Tighter spacing for horizontal featured shelf cards. */
  compact?: boolean;
};

/**
 * Shared card chrome for Starter and My Template library cards.
 * Source-specific cards supply preview media, badges, and actions.
 */
export const TemplateLibraryCardShell: React.FC<TemplateLibraryCardShellProps> = ({
  image,
  imageOverlay,
  overflowMenu,
  badges,
  title,
  titleId,
  description,
  metadata,
  footer,
  compact = false,
}) => (
  <article
    data-compact={compact ? true : undefined}
    className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    aria-labelledby={titleId}
  >
    <div className="relative aspect-[16/10] overflow-hidden bg-muted/30">
      {image}
      {imageOverlay}
      {overflowMenu ? <div className="absolute right-2 top-2 z-10">{overflowMenu}</div> : null}
    </div>
    <div className={`flex flex-1 flex-col ${compact ? "gap-2 p-3" : "gap-2.5 p-4"}`}>
      {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
      <h2
        id={titleId}
        className={`truncate font-semibold leading-snug tracking-tight ${compact ? "text-sm" : "text-base"}`}
        title={title}
      >
        {title}
      </h2>
      <p
        className={`text-xs leading-relaxed text-muted-foreground ${compact ? "line-clamp-1" : "line-clamp-2"}`}
        title={description}
      >
        {description}
      </p>
      {metadata ? <div className="text-[11px] text-muted-foreground">{metadata}</div> : null}
      <div className={`mt-auto flex flex-col ${compact ? "gap-1 pt-0" : "gap-1.5 pt-1"}`}>{footer}</div>
    </div>
  </article>
);

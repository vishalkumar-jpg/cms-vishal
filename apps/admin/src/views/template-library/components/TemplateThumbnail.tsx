import * as React from "react";
import type { SerializedLayout } from "@ob-cms/block-schema";
import type { TemplateKind } from "@/views/templates/types";
import type { TemplateCatalogEntry } from "@/views/template-catalog/types";
import { LayoutPreviewPane } from "@/views/builder/components/LayoutPreviewPane";
import { normalizePreviewLayout } from "@/views/builder/lib/normalizePreviewLayout";
import { useTemplateSkeletonByKey } from "@/views/template-catalog/hooks/useTemplateSkeleton";
import { cn } from "@/lib/cn";
import { useInViewport } from "../hooks/useInViewport";
import { StarterTemplateThumbnailFallback } from "./StarterTemplateThumbnailFallback";
import { TemplateLibraryMineKindPlaceholder } from "./TemplateLibraryMineKindPlaceholder";

export type TemplateThumbnailProps = {
  label: string;
  className?: string;
  /** Fills card media area (default) or dialog hero header. */
  variant?: "card" | "hero";
  /** When true, fetch/render immediately (preview dialogs). */
  eager?: boolean;
  /** Saved template layout JSON — normalized when the preview activates. */
  layout?: SerializedLayout;
  /** Fetch starter skeleton layout when active. */
  templateKey?: string | null;
  starterEntry?: Pick<TemplateCatalogEntry, "templateKey" | "thumbnail">;
  mineKind?: TemplateKind;
  compact?: boolean;
};

const ThumbnailShell: React.FC<{
  variant: "card" | "hero";
  className?: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}> = ({ variant, className, containerRef, children }) => (
  <div
    ref={containerRef}
    className={cn(
      "relative w-full overflow-hidden bg-muted/30",
      variant === "hero" ? "aspect-[16/10] shrink-0 border-b border-border" : "h-full",
      className,
    )}
    data-testid="template-thumbnail"
  >
    {children}
  </div>
);

const StarterSkeletonPreview: React.FC<{
  templateKey: string;
  starterEntry: Pick<TemplateCatalogEntry, "templateKey" | "thumbnail">;
  label: string;
  compact?: boolean;
}> = ({ templateKey, starterEntry, label, compact }) => {
  const { data: skeleton, isLoading, isError } = useTemplateSkeletonByKey(templateKey, true);
  const layout = React.useMemo(
    () => normalizePreviewLayout(skeleton?.content.layout),
    [skeleton?.content.layout],
  );

  return (
    <LayoutPreviewPane
      layout={layout}
      loading={isLoading}
      error={isError}
      fallback={<StarterTemplateThumbnailFallback entry={starterEntry} compact={compact} />}
      label={label}
      className="h-full w-full"
    />
  );
};

const MineLayoutPreview: React.FC<{
  rawLayout: SerializedLayout;
  mineKind: TemplateKind;
  label: string;
}> = ({ rawLayout, mineKind, label }) => {
  const layout = React.useMemo(() => normalizePreviewLayout(rawLayout), [rawLayout]);

  return (
    <LayoutPreviewPane
      layout={layout}
      error={!layout}
      fallback={<TemplateLibraryMineKindPlaceholder kind={mineKind} />}
      label={label}
      className="h-full w-full"
    />
  );
};

const TemplateThumbnailInner: React.FC<TemplateThumbnailProps> = ({
  label,
  className,
  variant = "card",
  eager = false,
  layout: layoutProp,
  templateKey = null,
  starterEntry,
  mineKind,
  compact = false,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inView = useInViewport(containerRef);
  const active = eager || inView;

  const usesSkeleton = Boolean(templateKey) && layoutProp === undefined;
  const usesMineLayout = layoutProp !== undefined && mineKind !== undefined;

  const idlePlaceholder = starterEntry ? (
    <StarterTemplateThumbnailFallback entry={starterEntry} compact={compact} />
  ) : mineKind !== undefined ? (
    <TemplateLibraryMineKindPlaceholder kind={mineKind} />
  ) : null;

  let content: React.ReactNode = idlePlaceholder;

  if (active && usesSkeleton && templateKey && starterEntry) {
    content = (
      <StarterSkeletonPreview
        templateKey={templateKey}
        starterEntry={starterEntry}
        label={label}
        compact={compact}
      />
    );
  } else if (active && usesMineLayout && layoutProp) {
    content = (
      <MineLayoutPreview rawLayout={layoutProp} mineKind={mineKind!} label={label} />
    );
  }

  return (
    <ThumbnailShell variant={variant} className={className} containerRef={containerRef}>
      {content}
    </ThumbnailShell>
  );
};

/** Shared live template thumbnail — cards, shelves, and preview dialogs. */
export const TemplateThumbnail = React.memo(TemplateThumbnailInner);

TemplateThumbnail.displayName = "TemplateThumbnail";

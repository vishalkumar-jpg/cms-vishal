import * as React from "react";
import { LayoutTemplate } from "lucide-react";

export type TemplateLibraryGridProps = {
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyText: string;
  loadingLabel?: string;
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
};

/** Responsive grid shell with loading and empty states. */
export const TemplateLibraryGrid: React.FC<TemplateLibraryGridProps> = ({
  isLoading,
  isEmpty,
  emptyText,
  loadingLabel = "Loading templates…",
  emptyAction,
  children,
}) => {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border shadow-sm">
            <div className="aspect-[16/10] animate-pulse bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
        <span className="sr-only">{loadingLabel}</span>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground"
        role="status"
      >
        <LayoutTemplate className="h-8 w-8 opacity-40" aria-hidden="true" />
        <p>{emptyText}</p>
        {emptyAction ? <div className="mt-2">{emptyAction}</div> : null}
      </div>
    );
  }

  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
};

import * as React from "react";
import { cn } from "@/lib/cn";

interface PanelProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** A titled card used to frame each analytics section. */
export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  action,
  className,
  children,
}) => (
  <section className={cn("rounded-lg border border-border bg-card p-5", className)}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

/** Compact loading / empty / error state used inside panels. */
export const PanelState: React.FC<{
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  loadingText?: string;
  errorText?: string;
  emptyText?: string;
}> = ({
  isLoading,
  isError,
  isEmpty,
  loadingText = "Loading…",
  errorText = "Could not load data.",
  emptyText = "No data for this range yet.",
}) => (
  <p className="py-8 text-center text-sm text-muted-foreground">
    {isError ? errorText : isLoading ? loadingText : isEmpty ? emptyText : ""}
  </p>
);

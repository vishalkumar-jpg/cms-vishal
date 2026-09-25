import * as React from "react";

export type TemplateLibraryFilterChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

/** Shared filter chip for Template Library toolbar category/kind filters. */
export const TemplateLibraryFilterChip: React.FC<TemplateLibraryFilterChipProps> = ({
  label,
  active,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={
      active
        ? "rounded-md border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
        : "rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
    }
  >
    {label}
  </button>
);

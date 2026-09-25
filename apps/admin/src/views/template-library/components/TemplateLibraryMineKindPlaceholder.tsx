import * as React from "react";
import { FileStack, LayoutTemplate } from "lucide-react";
import type { TemplateKind } from "@/views/templates/types";
import { MINE_TEMPLATE_PLACEHOLDER_LABEL, templateKindLabel } from "../constants";

const KIND_STYLES: Record<
  TemplateKind,
  { gradient: string; icon: React.ComponentType<{ className?: string }> }
> = {
  page: {
    gradient: "from-primary/20 via-primary/5 to-muted/40",
    icon: LayoutTemplate,
  },
  section: {
    gradient: "from-violet-500/20 via-violet-500/5 to-muted/40",
    icon: FileStack,
  },
};

/** Kind-themed placeholder for My Template cards and previews (no screenshot API). */
export const TemplateLibraryMineKindPlaceholder: React.FC<{
  kind: TemplateKind;
  className?: string;
}> = ({ kind, className = "" }) => {
  const style = KIND_STYLES[kind];
  const Icon = style.icon;

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br ${style.gradient} text-muted-foreground ${className}`}
      aria-hidden="true"
    >
      <Icon className="h-10 w-10 opacity-50" />
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {templateKindLabel(kind)}
      </span>
      <span className="text-[10px] font-medium opacity-50">{MINE_TEMPLATE_PLACEHOLDER_LABEL}</span>
    </div>
  );
};

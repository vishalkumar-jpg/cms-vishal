import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Consistent builder tooltips — replaces bare `title=` with readable,
 * multi-line hints that match the rest of the admin UI.
 */
export const BuilderTip: React.FC<{
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
}> = ({ content, children, side = "top" }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={side} className="max-w-[240px] whitespace-pre-line leading-snug">
      {content}
    </TooltipContent>
  </Tooltip>
);

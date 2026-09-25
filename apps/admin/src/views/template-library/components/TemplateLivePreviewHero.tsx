import * as React from "react";
import type { TemplateThumbnailProps } from "./TemplateThumbnail";
import { TemplateThumbnail } from "./TemplateThumbnail";
import { cn } from "@/lib/cn";

export type TemplateLivePreviewHeroProps = Omit<TemplateThumbnailProps, "variant" | "eager">;

/** Dialog-sized live preview frame — always eager, shares cache with card thumbnails. */
export const TemplateLivePreviewHero: React.FC<TemplateLivePreviewHeroProps> = ({
  className,
  ...props
}) => (
  <TemplateThumbnail
    {...props}
    variant="hero"
    eager
    className={cn(className)}
  />
);

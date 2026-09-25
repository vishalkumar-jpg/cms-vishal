import type { BadgeProps } from "@/components/ui/badge";
import type { TemplateCatalogCategory, TemplateCatalogStatus } from "../types";

export const CATEGORY_LABEL: Record<TemplateCatalogCategory, string> = {
  marketing: "Marketing",
  content: "Content",
  legal: "Legal",
  utility: "Utility",
  campaign: "Campaign",
};

export const STATUS_LABEL: Record<TemplateCatalogStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const STATUS_VARIANT: Record<TemplateCatalogStatus, BadgeProps["variant"]> = {
  draft: "muted",
  published: "success",
  archived: "outline",
};

export const USE_STARTER_TEMPLATE_LABEL = "Use Starter Template";
export const PUBLISHED_STARTER_ONLY_HINT = "Only published starters can create a page.";
export const STARTER_FILTER_ALL_LABEL = "All";

/** Metadata field labels shared by preview dialogs and cards. */
export const METADATA_LABEL = {
  category: "Category",
  status: "Status",
  version: "Version",
  pageTypes: "Page types",
  tags: "Tags",
  updated: "Updated",
  created: "Created",
  templateKey: "Template key",
  kind: "Type",
} as const;

/** Human labels for starter supported page type ids. */
export const PAGE_TYPE_LABEL: Record<string, string> = {
  homepage: "Homepage",
  landing: "Landing page",
  contact: "Contact",
  about: "About",
  "thank-you": "Thank you",
  utility: "Utility",
  legal: "Legal",
  "generic-content": "Generic content",
  "service-detail": "Service detail",
  "industry-detail": "Industry detail",
  careers: "Careers",
  "blog-listing": "Blog listing",
  "blog-detail": "Blog post",
  "resource-listing": "Resource listing",
  "resource-detail": "Resource detail",
};

export const STARTER_PREVIEW_METADATA_HINT =
  "Preview metadata. Layout will appear after creating the page.";

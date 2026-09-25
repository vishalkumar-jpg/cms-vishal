import { z } from "zod";
import { isReservedRootSlug } from "@ob-cms/shared";

/**
 * Page title/slug rules aligned with `CreatePageDto` /
 * `CreatePageFromTemplateDto` in apps/api `page.dto.ts`.
 */
export const PAGE_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/;
export const PAGE_TITLE_MAX = 300;
export const PAGE_SLUG_MAX = 200;

/** Lowercase hyphenated slug (trimmed, capped at API max length). */
export const slugifyPageTitle = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PAGE_SLUG_MAX)
    // Truncation can leave a trailing hyphen; strip so the value matches PAGE_SLUG_REGEX.
    .replace(/-+$/, "");

/** Optional SEO fields aligned with API PageSeoDto (subset used at create time). */
export const pageSeoMetaSchema = z.object({
  title: z
    .string()
    .trim()
    .max(PAGE_TITLE_MAX, `Meta title must be at most ${PAGE_TITLE_MAX} characters`)
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Meta description must be at most 500 characters")
    .optional(),
});

export const pageTitleSlugSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(PAGE_TITLE_MAX, `Title must be at most ${PAGE_TITLE_MAX} characters`),
  slug: z
    .string()
    .trim()
    .transform((value) => value.toLowerCase())
    .pipe(
      z
        .string()
        .min(1, "Slug is required")
        .max(PAGE_SLUG_MAX, `Slug must be at most ${PAGE_SLUG_MAX} characters`)
        .regex(
          PAGE_SLUG_REGEX,
          "Lowercase letters, numbers, and hyphens only (cannot start or end with a hyphen)",
        )
        .refine((slug) => !isReservedRootSlug(slug), {
          message: "This slug is reserved for system routes",
        }),
    ),
});

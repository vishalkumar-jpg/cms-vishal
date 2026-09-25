/**
 * Template registry schemas (PR #21 / Phase 1).
 *
 * @see docs/cms/cms-operations.md §1
 * @see docs/cms/starter-page-templates.md §2
 */
import { z } from "zod";

/** Catalog categories (machine ids; display labels are separate). */
export const TEMPLATE_CATEGORIES = [
  "marketing",
  "content",
  "legal",
  "utility",
  "campaign",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/**
 * Lifecycle status per cms-operations §1–§2.
 * (`deprecated` from early catalog docs maps to `archived`.)
 */
export const TEMPLATE_STATUSES = ["draft", "published", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const templateCategorySchema = z.enum(TEMPLATE_CATEGORIES);
export const templateStatusSchema = z.enum(TEMPLATE_STATUSES);

const isoDateTimeSchema = z.string().datetime({
  offset: true,
  message: "Must be a valid ISO-8601 date-time string",
});

/**
 * Platform starter template metadata.
 * Optional extension fields (featured, owner, …) support future phases
 * without redesign; they are not required for registry Phase 1.
 */
export const templateMetadataSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^tpl-[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: "Template id must match tpl-<slug> (lowercase kebab)",
      }),
    displayName: z.string().min(1),
    description: z.string().min(1),
    category: templateCategorySchema,
    supportedPageTypes: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string().min(1)).default([]),
    /** Placeholder media ref / path; real assets land in a later phase. */
    thumbnail: z.string().min(1).optional(),
    version: z.string().min(1),
    status: templateStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    /** Future: featured shelf (cms-operations §1.3). */
    featured: z.boolean().optional(),
    /** Future: ownership principal. */
    owner: z.string().min(1).optional(),
  })
  .strict();

export type TemplateMetadata = z.infer<typeof templateMetadataSchema>;

/** Input accepted by `register` before timestamps are filled. */
export const templateRegistrationInputSchema = templateMetadataSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({
    createdAt: isoDateTimeSchema.optional(),
    updatedAt: isoDateTimeSchema.optional(),
  })
  .strict();

export type TemplateRegistrationInput = z.infer<
  typeof templateRegistrationInputSchema
>;

/** Input accepted by `update` (id, timestamps, version, and status are immutable/system-managed). */
export const templateUpdateInputSchema = templateRegistrationInputSchema
  .omit({ 
    id: true, 
    createdAt: true, 
    updatedAt: true,
    version: true,
    status: true 
  })
  .partial()
  .strict();

export type TemplateUpdateInput = z.infer<
  typeof templateUpdateInputSchema
>;

export const templateQuerySchema = z
  .object({
    category: templateCategorySchema.optional(),
    status: templateStatusSchema.optional(),
    pageType: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
    featured: z.boolean().optional(),
    /** Case-insensitive match against id, displayName, description, tags. */
    query: z.string().optional(),
  })
  .strict();

export type TemplateQuery = z.infer<typeof templateQuerySchema>;

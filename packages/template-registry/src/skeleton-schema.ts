/**
 * Template skeleton schemas — metadata vs editable page structure.
 *
 * A skeleton stores the catalog metadata (aligned with {@link templateMetadataSchema})
 * separately from the layout/content payload used when copying structure into a page.
 *
 * @see docs/cms/template-skeleton-storage.md
 */
import { z } from "zod";
import {
  templateCategorySchema,
  templateStatusSchema,
  type TemplateCategory,
  type TemplateStatus,
} from "./schema";

/** Current content-payload schema version (layout/sections/pageStructure shape). */
export const SKELETON_CONTENT_SCHEMA_VERSION = "1.0" as const;

export const templateKeySchema = z
  .string()
  .min(1)
  .regex(/^tpl-[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Template key must match tpl-<slug> (lowercase kebab)",
  });

/** Preview/thumbnail metadata — no binary assets in this phase. */
export const templatePreviewMetadataSchema = z
  .object({
    thumbnail: z.string().min(1).optional(),
    featured: z.boolean().optional(),
    owner: z.string().min(1).optional(),
  })
  .strict()
  .default(() => ({}));

export type TemplatePreviewMetadata = z.infer<typeof templatePreviewMetadataSchema>;

/** Logical section slot within a template skeleton (not a Craft node). */
export const templateSkeletonSectionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    required: z.boolean(),
    optional: z.boolean(),
    defaultEnabled: z.boolean(),
    order: z.number().int().nonnegative(),
    componentFamilies: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine((section, ctx) => {
    if (section.required === section.optional) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          section.required && section.optional
            ? "Section cannot be both required and optional"
            : "Section must be either required or optional",
        path: section.required ? ["optional"] : ["required"],
      });
    }
  });

export type TemplateSkeletonSection = z.infer<typeof templateSkeletonSectionSchema>;

/** Section ordering and required/optional rules for the template. */
export const templatePageStructureSchema = z
  .object({
    defaultSectionOrder: z.array(z.string().min(1)),
    requiredSectionIds: z.array(z.string().min(1)),
    optionalSectionIds: z.array(z.string().min(1)),
  })
  .strict()
  .default(() => ({
    defaultSectionOrder: [],
    requiredSectionIds: [],
    optionalSectionIds: [],
  }));

export type TemplatePageStructure = z.infer<typeof templatePageStructureSchema>;

/**
 * Editable skeleton content — layout tree + logical sections + default props.
 * `layout` is validated against `@ob-cms/block-schema` at the service boundary.
 */
const templateSkeletonContentBaseSchema = z
  .object({
    /** Content-payload compatibility stamp — version of layout/sections shape in this row. */
    contentSchemaVersion: z.string().min(1).default(SKELETON_CONTENT_SCHEMA_VERSION),
    layout: z.record(z.unknown()),
    sections: z.array(templateSkeletonSectionSchema).default(() => []),
    pageStructure: templatePageStructureSchema,
    componentProps: z.record(z.unknown()).default(() => ({})),
  })
  .strict();

export const templateSkeletonContentSchema = templateSkeletonContentBaseSchema.superRefine(
  (content, ctx) => {
    const firstIndexById = new Map<string, number>();
    content.sections.forEach((section, index) => {
      const first = firstIndexById.get(section.id);
      if (first !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate section id "${section.id}"`,
          path: ["sections", index, "id"],
        });
      } else {
        firstIndexById.set(section.id, index);
      }
    });

    const sectionIds = new Set(content.sections.map((section) => section.id));
    const requiredIds = new Set(content.pageStructure.requiredSectionIds);
    const optionalIds = new Set(content.pageStructure.optionalSectionIds);

    content.sections.forEach((section, index) => {
      if (section.required) {
        if (!requiredIds.has(section.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Required section "${section.id}" must appear in pageStructure.requiredSectionIds`,
            path: ["sections", index, "required"],
          });
        }
        if (optionalIds.has(section.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Required section "${section.id}" must not appear in pageStructure.optionalSectionIds`,
            path: ["sections", index, "required"],
          });
        }
      }
      if (section.optional) {
        if (!optionalIds.has(section.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Optional section "${section.id}" must appear in pageStructure.optionalSectionIds`,
            path: ["sections", index, "optional"],
          });
        }
        if (requiredIds.has(section.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Optional section "${section.id}" must not appear in pageStructure.requiredSectionIds`,
            path: ["sections", index, "optional"],
          });
        }
      }
    });

    const checkRef = (id: string, pathPrefix: (string | number)[]): void => {
      if (!sectionIds.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown section id "${id}" — not defined in sections`,
          path: pathPrefix,
        });
      }
    };

    content.pageStructure.defaultSectionOrder.forEach((id, index) => {
      checkRef(id, ["pageStructure", "defaultSectionOrder", index]);
    });
    content.pageStructure.requiredSectionIds.forEach((id, index) => {
      checkRef(id, ["pageStructure", "requiredSectionIds", index]);
    });
    content.pageStructure.optionalSectionIds.forEach((id, index) => {
      checkRef(id, ["pageStructure", "optionalSectionIds", index]);
    });

    const requiredSet = new Set(content.pageStructure.requiredSectionIds);
    content.pageStructure.optionalSectionIds.forEach((id, index) => {
      if (requiredSet.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Section id "${id}" cannot appear in both requiredSectionIds and optionalSectionIds`,
          path: ["pageStructure", "optionalSectionIds", index],
        });
      }
    });
  },
);

export type TemplateSkeletonContent = z.infer<typeof templateSkeletonContentSchema>;

const isoDateTimeSchema = z.string().datetime({
  offset: true,
  message: "Must be a valid ISO-8601 date-time string",
});

/** Persisted catalog metadata for a template skeleton (no layout JSON). */
export const templateSkeletonMetadataSchema = z
  .object({
    id: z.string().min(1),
    templateKey: templateKeySchema,
    displayName: z.string().min(1),
    description: z.string().min(1),
    category: templateCategorySchema,
    supportedPageTypes: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string().min(1)).default(() => []),
    previewMetadata: templatePreviewMetadataSchema,
    version: z.string().min(1),
    status: templateStatusSchema,
    /**
     * Metadata-row compatibility stamp — which content payload shape this skeleton
     * expects. Authoritative on the metadata row; see content.contentSchemaVersion for the
     * payload copy stored alongside layout JSON.
     */
    schemaVersion: z.string().min(1),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type TemplateSkeletonMetadata = z.infer<typeof templateSkeletonMetadataSchema>;

export const templateSkeletonRecordSchema = z
  .object({
    metadata: templateSkeletonMetadataSchema,
    content: templateSkeletonContentSchema,
  })
  .strict();

export type TemplateSkeletonRecord = z.infer<typeof templateSkeletonRecordSchema>;

/** Input for creating a skeleton (ids/timestamps assigned by storage). */
export const createTemplateSkeletonInputSchema = z
  .object({
    templateKey: templateKeySchema,
    displayName: z.string().min(1),
    description: z.string().min(1),
    category: templateCategorySchema,
    supportedPageTypes: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string().min(1)).default(() => []),
    previewMetadata: templatePreviewMetadataSchema,
    version: z.string().min(1),
    status: templateStatusSchema.default("draft"),
    /**
     * Metadata-row compatibility stamp (defaults to current content version).
     * Paired content.contentSchemaVersion validates the layout/sections payload shape.
     */
    schemaVersion: z.string().min(1).default(SKELETON_CONTENT_SCHEMA_VERSION),
    content: templateSkeletonContentSchema,
  })
  .strict();

export type CreateTemplateSkeletonInput = z.infer<typeof createTemplateSkeletonInputSchema>;

export const updateTemplateSkeletonMetadataInputSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    category: templateCategorySchema.optional(),
    supportedPageTypes: z.array(z.string().min(1)).min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
    previewMetadata: templatePreviewMetadataSchema.optional(),
    version: z.string().min(1).optional(),
    status: templateStatusSchema.optional(),
    schemaVersion: z.string().min(1).optional(),
  })
  .strict();

export type UpdateTemplateSkeletonMetadataInput = z.infer<
  typeof updateTemplateSkeletonMetadataInputSchema
>;

export const updateTemplateSkeletonContentInputSchema = templateSkeletonContentBaseSchema
  .partial()
  .strict();

export type UpdateTemplateSkeletonContentInput = z.infer<
  typeof updateTemplateSkeletonContentInputSchema
>;

export const updateTemplateSkeletonInputSchema = z
  .object({
    metadata: updateTemplateSkeletonMetadataInputSchema.optional(),
    content: updateTemplateSkeletonContentInputSchema.optional(),
  })
  .strict()
  .refine((v) => v.metadata !== undefined || v.content !== undefined, {
    message: "At least one of metadata or content must be provided",
  });

export type UpdateTemplateSkeletonInput = z.infer<typeof updateTemplateSkeletonInputSchema>;

export const templateSkeletonListQuerySchema = z
  .object({
    category: templateCategorySchema.optional(),
    status: templateStatusSchema.optional(),
    pageType: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
    query: z.string().optional(),
  })
  .strict();

export type TemplateSkeletonListQuery = z.infer<typeof templateSkeletonListQuerySchema>;

export class TemplateSkeletonValidationError extends Error {
  constructor(
    message: string,
    readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = "TemplateSkeletonValidationError";
  }
}

/** Parse and validate create input; throws {@link TemplateSkeletonValidationError}. */
export function parseCreateTemplateSkeletonInput(
  input: unknown,
): CreateTemplateSkeletonInput {
  const result = createTemplateSkeletonInputSchema.safeParse(input);
  if (!result.success) {
    throw new TemplateSkeletonValidationError("Invalid template skeleton input", result.error.issues);
  }
  return result.data;
}

/** Parse and validate update input; throws {@link TemplateSkeletonValidationError}. */
export function parseUpdateTemplateSkeletonInput(
  input: unknown,
): UpdateTemplateSkeletonInput {
  const result = updateTemplateSkeletonInputSchema.safeParse(input);
  if (!result.success) {
    throw new TemplateSkeletonValidationError("Invalid template skeleton update", result.error.issues);
  }
  return result.data;
}

/** Parse list query filters. */
export function parseTemplateSkeletonListQuery(input: unknown): TemplateSkeletonListQuery {
  const result = templateSkeletonListQuerySchema.safeParse(input ?? {});
  if (!result.success) {
    throw new TemplateSkeletonValidationError("Invalid template skeleton list query", result.error.issues);
  }
  return result.data;
}

export type { TemplateCategory, TemplateStatus };

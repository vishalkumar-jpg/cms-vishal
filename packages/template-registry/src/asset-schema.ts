/**
 * Template skeleton preview asset schemas — metadata references only (no binary storage).
 *
 * @see docs/cms/template-skeleton-assets.md
 */
import { z } from "zod";

/** Supported preview asset roles for catalog display. */
export const TEMPLATE_SKELETON_ASSET_TYPES = [
  "thumbnail",
  "cover_image",
  "gallery_image",
  "icon",
  "video_preview",
] as const;

export type TemplateSkeletonAssetType = (typeof TEMPLATE_SKELETON_ASSET_TYPES)[number];

/** At most one active asset per skeleton for these types. */
export const SINGLETON_TEMPLATE_SKELETON_ASSET_TYPES = [
  "thumbnail",
  "cover_image",
  "icon",
  "video_preview",
] as const;

export type SingletonTemplateSkeletonAssetType =
  (typeof SINGLETON_TEMPLATE_SKELETON_ASSET_TYPES)[number];

export const templateSkeletonAssetTypeSchema = z.enum(TEMPLATE_SKELETON_ASSET_TYPES);

const isoDateTimeSchema = z.string().datetime({
  offset: true,
  message: "Must be a valid ISO-8601 date-time string",
});

/** http(s) URL or site-relative path — no binary upload in this phase. */
function isValidAssetUrl(value: string): boolean {
  // URL parsers strip ASCII tab/newline/CR before resolving paths or hostnames.
  if (/[\t\n\r]/.test(value)) return false;
  if (/^https?:\/\/.+/i.test(value)) return true;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  return true;
}

export const templateSkeletonAssetUrlSchema = z
  .string()
  .min(1)
  .refine(isValidAssetUrl, {
    message: "Must be an http(s) URL or site-relative path starting with /",
  });

export const templateSkeletonAssetMimeTypeSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i, {
    message: "Must be a valid MIME type (type/subtype)",
  });

const imageMimePattern = /^image\//i;
const videoMimePattern = /^video\//i;

function mimeValidationMessage(
  assetType: TemplateSkeletonAssetType,
  mimeType: string,
): string | null {
  const mimeLower = mimeType.toLowerCase();
  if (assetType === "video_preview") {
    if (!videoMimePattern.test(mimeType) && mimeLower !== "application/x-mpegurl") {
      return "video_preview assets require a video/* or application/x-mpegURL MIME type";
    }
    return null;
  }
  if (!imageMimePattern.test(mimeType)) {
    return `${assetType} assets require an image/* MIME type`;
  }
  return null;
}

/** Throws when mimeType is present but incompatible with assetType. */
export function assertMimeMatchesAssetType(
  assetType: TemplateSkeletonAssetType,
  mimeType: string | undefined,
): void {
  if (!mimeType) return;
  const message = mimeValidationMessage(assetType, mimeType);
  if (message) {
    throw new TemplateSkeletonAssetValidationError(message, []);
  }
}

export const templateSkeletonAssetRecordSchema = z
  .object({
    id: z.string().min(1),
    skeletonId: z.string().min(1),
    assetType: templateSkeletonAssetTypeSchema,
    storageKey: z.string().min(1).nullable(),
    url: templateSkeletonAssetUrlSchema,
    mimeType: templateSkeletonAssetMimeTypeSchema.nullable(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    size: z.number().int().nonnegative().nullable(),
    altText: z.string().min(1).nullable(),
    sortOrder: z.number().int().nonnegative(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type TemplateSkeletonAssetRecord = z.infer<typeof templateSkeletonAssetRecordSchema>;

export const createTemplateSkeletonAssetInputSchema = z
  .object({
    assetType: templateSkeletonAssetTypeSchema,
    url: templateSkeletonAssetUrlSchema,
    storageKey: z.string().min(1).optional(),
    mimeType: templateSkeletonAssetMimeTypeSchema.optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    size: z.number().int().nonnegative().optional(),
    altText: z.string().min(1).optional(),
    sortOrder: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.mimeType) return;
    const message = mimeValidationMessage(data.assetType, data.mimeType);
    if (message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: ["mimeType"],
      });
    }
  });

export type CreateTemplateSkeletonAssetInput = z.infer<
  typeof createTemplateSkeletonAssetInputSchema
>;

export const updateTemplateSkeletonAssetInputSchema = z
  .object({
    url: templateSkeletonAssetUrlSchema.optional(),
    storageKey: z.string().min(1).nullable().optional(),
    mimeType: templateSkeletonAssetMimeTypeSchema.nullable().optional(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    size: z.number().int().nonnegative().nullable().optional(),
    altText: z.string().min(1).nullable().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateTemplateSkeletonAssetInput = z.infer<
  typeof updateTemplateSkeletonAssetInputSchema
>;

export class TemplateSkeletonAssetValidationError extends Error {
  constructor(
    message: string,
    readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = "TemplateSkeletonAssetValidationError";
  }
}

/** Parse and validate create input; throws {@link TemplateSkeletonAssetValidationError}. */
export function parseCreateTemplateSkeletonAssetInput(
  input: unknown,
): CreateTemplateSkeletonAssetInput {
  const result = createTemplateSkeletonAssetInputSchema.safeParse(input);
  if (!result.success) {
    throw new TemplateSkeletonAssetValidationError(
      "Invalid template skeleton asset input",
      result.error.issues,
    );
  }
  return result.data;
}

/** Parse and validate update input; throws {@link TemplateSkeletonAssetValidationError}. */
export function parseUpdateTemplateSkeletonAssetInput(
  input: unknown,
): UpdateTemplateSkeletonAssetInput {
  const result = updateTemplateSkeletonAssetInputSchema.safeParse(input);
  if (!result.success) {
    throw new TemplateSkeletonAssetValidationError(
      "Invalid template skeleton asset update",
      result.error.issues,
    );
  }
  return result.data;
}

export function isSingletonAssetType(
  assetType: TemplateSkeletonAssetType,
): assetType is SingletonTemplateSkeletonAssetType {
  return (SINGLETON_TEMPLATE_SKELETON_ASSET_TYPES as readonly string[]).includes(assetType);
}

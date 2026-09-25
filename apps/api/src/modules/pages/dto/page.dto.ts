import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

/** Page slug: lowercase alnum + hyphen, optional nested segments are not allowed. */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/;
/** i18n locale code: lowercase, e.g. "en", "es", "pt-br". */
const LOCALE_CODE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;

export class PageSeoDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  canonical?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  ogImage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  noindex?: boolean;
}

export class PageLayoutOptionsDto {
  @ApiProperty({ required: false, description: "Inherit homepage topbar/navbar/footer (default true)." })
  @IsOptional()
  @IsBoolean()
  inheritHomepageChrome?: boolean;

  @ApiProperty({ required: false, description: "Hide the inherited topbar on this page." })
  @IsOptional()
  @IsBoolean()
  hideTopbar?: boolean;

  @ApiProperty({ required: false, description: "Hide the inherited navbar on this page." })
  @IsOptional()
  @IsBoolean()
  hideNavbar?: boolean;

  @ApiProperty({ required: false, description: "Hide the inherited footer on this page." })
  @IsOptional()
  @IsBoolean()
  hideFooter?: boolean;
}

export class CreatePageDto {
  @ApiProperty({ example: "Home" })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiProperty({ example: "home" })
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug!: string;

  @ApiProperty({ required: false, description: "Initial draft SerializedLayout" })
  @IsOptional()
  @IsObject()
  draftLayout?: Record<string, unknown>;

  @ApiProperty({ required: false, type: PageSeoDto })
  @IsOptional()
  @IsObject()
  seo?: PageSeoDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;
}

/**
 * Creates a draft page by copying one published platform template skeleton.
 * The orchestration service enforces that exactly one skeleton reference is set.
 */
export class CreatePageFromTemplateDto {
  @ApiProperty({ example: "Campaign Landing" })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiProperty({ example: "campaign-landing" })
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug!: string;

  @ApiProperty({ required: false, example: "tsk_2Yc..." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  skeletonId?: string;

  @ApiProperty({ required: false, example: "tpl-saas-landing" })
  @IsOptional()
  @Transform(trim)
  @Matches(/^tpl-[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "templateKey must start with tpl- and use lowercase letters, numbers, and hyphens",
  })
  templateKey?: string;

  @ApiProperty({ required: false, type: PageSeoDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PageSeoDto)
  seo?: PageSeoDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdatePageDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug?: string;

  @ApiProperty({ required: false, type: PageSeoDto })
  @IsOptional()
  @IsObject()
  seo?: PageSeoDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ required: false, enum: ["draft", "published", "scheduled", "archived"] })
  @IsOptional()
  @IsIn(["draft", "published", "scheduled", "archived"])
  status?: string;

  /**
   * CONTENT-OPS expiry: when to auto-unpublish. ISO-8601 string to set, or `null`
   * to clear. Omit to leave unchanged. Past values are allowed (the worker will
   * unpublish on its next tick).
   */
  @ApiProperty({ required: false, nullable: true, example: "2026-12-31T00:00:00.000Z" })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsISO8601()
  expiresAt?: string | null;

  @ApiProperty({ required: false, type: PageLayoutOptionsDto })
  @IsOptional()
  @IsObject()
  layoutOptions?: PageLayoutOptionsDto;
}

export class SaveDraftDto {
  @ApiProperty({ description: "Full SerializedLayout to autosave into draftLayout" })
  @IsObject()
  layout!: Record<string, unknown>;

  @ApiProperty({ required: false, type: PageSeoDto })
  @IsOptional()
  @IsObject()
  seo?: PageSeoDto;
}

export class SchedulePageDto {
  @ApiProperty({ example: "2026-07-01T09:00:00.000Z" })
  @IsISO8601()
  scheduledAt!: string;
}

export class ImportPocDto {
  @ApiProperty({ required: false, description: "Slug for the imported page (auto from title if omitted)" })
  @IsOptional()
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug?: string;

  @ApiProperty({ description: "The POC export { metadata, craft }" })
  @IsObject()
  export!: Record<string, unknown>;
}

export class ListPagesQueryDto {
  @ApiProperty({ required: false, enum: ["draft", "published", "scheduled", "archived"] })
  @IsOptional()
  @IsIn(["draft", "published", "scheduled", "archived"])
  status?: string;

  @ApiProperty({ required: false, enum: ["draft", "in_review", "approved", "published"] })
  @IsOptional()
  @IsIn(["draft", "in_review", "approved", "published"])
  state?: string;

  @ApiProperty({
    required: false,
    description: "Review-queue filter: 'me' = pages assigned to the current user.",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  assignedTo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiProperty({ required: false, description: "i18n: filter to a single locale's pages." })
  @IsOptional()
  @Transform(lower)
  @Matches(LOCALE_CODE, { message: "locale must be a code like 'en' or 'pt-br'" })
  locale?: string;
}

/**
 * POST /pages/:id/translations — i18n (B13). Clone a source page into a new
 * locale: same translationKey, a different locale, its own slug, status draft.
 */
export class CreateTranslationDto {
  @ApiProperty({ example: "es", description: "Target locale (must be in the site's locale set)." })
  @Transform(lower)
  @Matches(LOCALE_CODE, { message: "locale must be a code like 'en' or 'pt-br'" })
  locale!: string;

  @ApiProperty({ required: false, description: "Slug for the translation (defaults to the source slug)." })
  @IsOptional()
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug?: string;
}

/** POST /pages/:id/submit-review — draft → in_review (optionally assign a reviewer). */
export class SubmitReviewDto {
  @ApiProperty({ required: false, description: "User id of the reviewer to assign." })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  reviewerId?: string;
}

/** POST /pages/:id/approve — in_review → approved (editor+). */
export class ApproveDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** POST /pages/:id/reject — in_review → draft, with a required reason. */
export class RejectDto {
  @ApiProperty({ description: "Why the content was rejected (shown to the author)." })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;
}

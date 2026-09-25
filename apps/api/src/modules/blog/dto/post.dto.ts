import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
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
import { PageSeoDto } from "@modules/pages/dto/page.dto";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toLowerCase() : value;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/;
/** i18n locale code: lowercase, e.g. "en", "es", "pt-br". */
const LOCALE_CODE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;

export class PostTermDto {
  @ApiProperty({ enum: ["category", "tag"] })
  @IsIn(["category", "tag"])
  kind!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  name!: string;
}

export class CreatePostDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiProperty()
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(600)
  excerpt?: string;

  @ApiProperty({ required: false, description: "SerializedLayout or richtext doc" })
  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverMediaId?: string;

  @ApiProperty({ required: false, type: PageSeoDto })
  @IsOptional()
  @IsObject()
  seo?: PageSeoDto;

  @ApiProperty({ required: false, type: [PostTermDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostTermDto)
  terms?: PostTermDto[];
}

export class UpdatePostDto {
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

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(600)
  excerpt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverMediaId?: string;

  @ApiProperty({ required: false, type: PageSeoDto })
  @IsOptional()
  @IsObject()
  seo?: PageSeoDto;

  @ApiProperty({ required: false, type: [PostTermDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostTermDto)
  terms?: PostTermDto[];

  @ApiProperty({ required: false, enum: ["draft", "published", "scheduled", "archived"] })
  @IsOptional()
  @IsIn(["draft", "published", "scheduled", "archived"])
  status?: string;

  /**
   * CONTENT-OPS expiry: when to auto-unpublish. ISO-8601 to set, or `null` to
   * clear. Omit to leave unchanged.
   */
  @ApiProperty({ required: false, nullable: true, example: "2026-12-31T00:00:00.000Z" })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsISO8601()
  expiresAt?: string | null;
}

export class SchedulePostDto {
  @ApiProperty()
  @IsISO8601()
  scheduledAt!: string;
}

/** Autosave the draft layout only (visual builder PUT). */
export class SavePostLayoutDto {
  @ApiProperty({ description: "SerializedLayout (Craft node JSON serialized via craftToLayout)" })
  @IsObject()
  layout!: Record<string, unknown>;
}

export class ListPostsQueryDto {
  @ApiProperty({ required: false, enum: ["draft", "published", "scheduled", "archived"] })
  @IsOptional()
  @IsIn(["draft", "published", "scheduled", "archived"])
  status?: string;

  @ApiProperty({ required: false, description: "Filter by category term slug/name." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(140)
  category?: string;

  @ApiProperty({ required: false, description: "Filter by tag term slug/name." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(140)
  tag?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiProperty({ required: false, enum: ["draft", "in_review", "approved", "published"] })
  @IsOptional()
  @IsIn(["draft", "in_review", "approved", "published"])
  state?: string;

  @ApiProperty({
    required: false,
    description: "Review-queue filter: 'me' = posts assigned to the current user.",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  assignedTo?: string;

  @ApiProperty({ required: false, description: "Set 'true' to list soft-deleted (trash) posts." })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === "true")
  trashed?: boolean;

  @ApiProperty({ required: false, description: "i18n: filter to a single locale's posts." })
  @IsOptional()
  @Transform(lower)
  @Matches(LOCALE_CODE, { message: "locale must be a code like 'en' or 'pt-br'" })
  locale?: string;
}

/**
 * POST /posts/:id/translations — i18n (B13). Clone a source post into a new
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

/** POST /posts/:id/submit-review — draft → in_review (optionally assign a reviewer). */
export class SubmitReviewDto {
  @ApiProperty({ required: false, description: "User id of the reviewer to assign." })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  reviewerId?: string;
}

/** POST /posts/:id/approve — in_review → approved (editor+). */
export class ApproveDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** POST /posts/:id/reject — in_review → draft, with a required reason. */
export class RejectDto {
  @ApiProperty({ description: "Why the content was rejected (shown to the author)." })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;
}

/** Bulk operation over a set of post ids. */
export class BulkPostsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

/** Create or rename a taxonomy term. */
export class TermDto {
  @ApiProperty({ enum: ["category", "tag"] })
  @IsIn(["category", "tag"])
  kind!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class UpdateTermDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class ListTermsQueryDto {
  @ApiProperty({ required: false, enum: ["category", "tag"] })
  @IsOptional()
  @IsIn(["category", "tag"])
  kind?: string;
}

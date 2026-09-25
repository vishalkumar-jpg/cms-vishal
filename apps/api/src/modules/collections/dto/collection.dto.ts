import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export const COLLECTION_FIELD_TYPES = [
  "text",
  "richtext",
  "number",
  "boolean",
  "image",
  "date",
  "reference",
] as const;
export type CollectionFieldType = (typeof COLLECTION_FIELD_TYPES)[number];

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/;
const FIELD_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,79}$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export class CollectionFieldDto {
  @ApiProperty({ description: "Machine key used in item data" })
  @Transform(trim)
  @Matches(FIELD_KEY, { message: "key must start with a letter and be alphanumeric/underscore" })
  key!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  label!: string;

  @ApiProperty({ enum: COLLECTION_FIELD_TYPES })
  @IsIn(COLLECTION_FIELD_TYPES)
  type!: CollectionFieldType;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateCollectionDto {
  @ApiProperty({ example: "Case Studies" })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: "case-studies" })
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug!: string;

  @ApiProperty({ required: false, type: [CollectionFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionFieldDto)
  fields?: CollectionFieldDto[];

  /** Optional shared detail layout (SerializedLayout). Omitted → null. */
  @ApiProperty({ required: false, nullable: true, type: Object })
  @IsOptional()
  @IsObject()
  detailLayout?: Record<string, unknown> | null;
}

export class UpdateCollectionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug?: string;

  @ApiProperty({ required: false, type: [CollectionFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionFieldDto)
  fields?: CollectionFieldDto[];

  /**
   * Shared detail layout. `null` clears; omit leaves unchanged.
   * Validated via deserializeLayout in the service (same as pages).
   * `@IsOptional()` skips validators for both `undefined` and `null` (class-validator 0.14.1).
   */
  @ApiProperty({ required: false, nullable: true, type: Object })
  @IsOptional()
  @IsObject()
  detailLayout?: Record<string, unknown> | null;
}

/** Autosave the collection detail layout only (visual builder PATCH). */
export class UpdateCollectionDetailLayoutDto {
  /**
   * Shared detail layout. `null` clears; object is validated via deserializeLayout.
   * `@IsOptional()` skips validators for both `undefined` and `null` (class-validator 0.14.1).
   */
  @ApiProperty({ nullable: true, type: Object })
  @IsOptional()
  @IsObject()
  detailLayout!: Record<string, unknown> | null;
}

export class CreateCollectionItemDto {
  @ApiProperty({ example: "acme-launch" })
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug!: string;

  @ApiProperty({ required: false, description: "Field values keyed by field key" })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class UpdateCollectionItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class ListItemsQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @ApiProperty({ required: false, enum: ["draft", "published"] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false, description: "field key to sort by (prefix - for desc)" })
  @IsOptional()
  @IsString()
  sort?: string;
}

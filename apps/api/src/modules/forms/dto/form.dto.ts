import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** Supported field types (FORM-1). Mirrors the renderer's field palette. */
export const FORM_FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "textarea",
  "select",
  "multiselect",
  "radio",
  "checkbox",
  "number",
  "date",
  "hidden",
  "consent",
  "file",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export class FormFieldValidationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  minLength?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  maxLength?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pattern?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  format?: string;
}

export class FormFieldOptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  label!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  value!: string;
}

export class FormFieldDto {
  @ApiProperty({ enum: FORM_FIELD_TYPES })
  @IsIn(FORM_FIELD_TYPES)
  type!: FormFieldType;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  label!: string;

  @ApiProperty({ description: "Machine name / submission key" })
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ required: false, description: "0-based step index for multi-step forms" })
  @IsOptional()
  @IsInt()
  @Min(0)
  step?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;

  @ApiProperty({ required: false, type: FormFieldValidationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FormFieldValidationDto)
  validation?: FormFieldValidationDto;

  @ApiProperty({ required: false, type: [FormFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldOptionDto)
  options?: FormFieldOptionDto[];

  @ApiProperty({ required: false, description: "{ field, op, value } conditional logic" })
  @IsOptional()
  @IsObject()
  conditional?: Record<string, unknown>;
}

export class CreateFormDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false, type: [FormFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];

  @ApiProperty({ required: false, description: "FormSettings" })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiProperty({ required: false, description: "fieldName -> CRM property" })
  @IsOptional()
  @IsObject()
  crmMapping?: Record<string, string>;
}

export class UpdateFormDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false, type: [FormFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  crmMapping?: Record<string, string>;
}

export class ListSubmissionsQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @ApiProperty({ required: false, enum: ["hide", "only", "all"], description: "spam filter" })
  @IsOptional()
  @IsIn(["hide", "only", "all"])
  spam?: "hide" | "only" | "all";

  @ApiProperty({ required: false, enum: ["read", "unread", "all"], description: "read state filter" })
  @IsOptional()
  @IsIn(["read", "unread", "all"])
  read?: "read" | "unread" | "all";

  @ApiProperty({ required: false, description: "ISO date — only submissions on/after" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({ required: false, description: "ISO date — only submissions on/before" })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({ required: false, description: "text search across submission values (data jsonb)" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  q?: string;
}

/** Triage patch — mark a submission spam/not-spam and/or read/unread (editor+). */
export class TriageSubmissionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isSpam?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

/** Time-window for the submission analytics endpoint. */
export class AnalyticsQueryDto {
  @ApiProperty({ required: false, default: 30, description: "trailing day window for the series" })
  @IsOptional()
  @Type(() => Number)
  days?: number;
}

/** Per-site CRM endpoint/secret/dual-write config (site_admin+). */
export class CrmConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  crmWebhookUrl?: string;

  @ApiProperty({ required: false, description: "write-only — never returned" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  crmHmacSecret?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  crmDualWrite?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  crmLegacyUrl?: string;
}

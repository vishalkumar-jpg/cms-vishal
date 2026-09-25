import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** Valid forms→CRM delivery states (mirrors form_submissions.status). */
export const CRM_DELIVERY_STATUSES = [
  "stored",
  "delivering",
  "delivered",
  "failed",
  "dead_lettered",
] as const;

export const ERROR_SOURCES = ["renderer", "admin", "api"] as const;

/** Shared limit/offset paging for the list endpoints. */
class PagingQuery {
  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class CrmDeliveriesQueryDto extends PagingQuery {
  @ApiProperty({ required: false, enum: CRM_DELIVERY_STATUSES })
  @IsOptional()
  @IsIn(CRM_DELIVERY_STATUSES as unknown as string[])
  status?: string;
}

export class ErrorsQueryDto extends PagingQuery {
  @ApiProperty({ required: false, enum: ERROR_SOURCES })
  @IsOptional()
  @IsIn(ERROR_SOURCES as unknown as string[])
  source?: string;
}

/** Public ingest payload for a runtime error (#37). */
export class IngestErrorDto {
  @ApiProperty({ example: "TypeError: Cannot read properties of undefined" })
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  stack?: string;

  @ApiProperty({ required: false, example: "https://example.com/pricing" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  url?: string;

  @ApiProperty({ required: false, enum: ERROR_SOURCES, default: "renderer" })
  @IsOptional()
  @IsIn(ERROR_SOURCES as unknown as string[])
  source?: string;
}

/** Terminal + in-flight page-audit run states (mirrors the worker lifecycle). */
export const PAGE_AUDIT_STATUSES = [
  "seam",
  "pending",
  "running",
  "completed",
  "skipped",
  "failed",
] as const;

export class AuditsQueryDto extends PagingQuery {
  @ApiProperty({ required: false, example: "/pricing" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  path?: string;

  @ApiProperty({ required: false, enum: PAGE_AUDIT_STATUSES })
  @IsOptional()
  @IsIn(PAGE_AUDIT_STATUSES as unknown as string[])
  status?: string;

  @ApiProperty({ required: false, description: "Only audits ran at/after this ISO timestamp." })
  @IsOptional()
  @Transform(trim)
  @IsDateString()
  @MaxLength(40)
  from?: string;

  @ApiProperty({ required: false, description: "Only audits ran at/before this ISO timestamp." })
  @IsOptional()
  @Transform(trim)
  @IsDateString()
  @MaxLength(40)
  to?: string;
}

/** Paging for the broken-links list (SITE-HEALTH). */
export class LinksQueryDto extends PagingQuery {}

/** Scheduled-scan cadence (Phase 5). */
export const AUDIT_FREQUENCIES = ["daily", "weekly"] as const;

/** Per-site scheduled PageSpeed scan config (Phase 5). */
export class AuditScheduleDto {
  @ApiProperty({ description: "Master switch for automatic scans." })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ enum: AUDIT_FREQUENCIES })
  @IsIn(AUDIT_FREQUENCIES as unknown as string[])
  frequency!: "daily" | "weekly";

  @ApiProperty({ required: false, minimum: 0, maximum: 23, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hour?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 6, description: "0=Sun … 6=Sat (weekly)." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;
}

/** Per-site performance-alert thresholds (Phase 5). */
export class AuditAlertsDto {
  @ApiProperty({ description: "Master switch for threshold alerting." })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  performance?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  accessibility?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  seo?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  bestPractices?: number;

  @ApiProperty({ required: false, minimum: 0, description: "Max acceptable LCP in ms." })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lcpMs?: number;

  @ApiProperty({ required: false, minimum: 0, description: "Max acceptable CLS (unitless)." })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cls?: number;
}

/** Update the site's scheduled-scan + alert-threshold config (Phase 5). */
export class UpdateAuditConfigDto {
  @ApiProperty({ required: false, type: AuditScheduleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuditScheduleDto)
  schedule?: AuditScheduleDto;

  @ApiProperty({ required: false, type: AuditAlertsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuditAlertsDto)
  alerts?: AuditAlertsDto;
}

/** Trigger a real Lighthouse page-audit run for a path (#30). */
export class RunAuditDto {
  @ApiProperty({ example: "/pricing" })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  path!: string;

  @ApiProperty({ required: false, description: "Optional page id the path maps to." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  pageId?: string;
}

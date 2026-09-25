import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/**
 * The site's Consent Management config (site_admin-edited). The whole object is
 * the desired state; omitted keys clear. Published verbatim on `/api/v1/public/site`
 * and consumed by the renderer's consent banner + tracker gates.
 */
export class UpdateConsentConfigDto {
  @ApiProperty({ required: false, description: "Master switch — show the banner + gate trackers." })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false, enum: ["all", "eu"] })
  @IsOptional()
  @IsIn(["all", "eu"])
  mode?: "all" | "eu";

  @ApiProperty({ required: false, enum: ["bottom", "top", "bottom-left", "bottom-right"] })
  @IsOptional()
  @IsIn(["bottom", "top", "bottom-left", "bottom-right"])
  position?: "bottom" | "top" | "bottom-left" | "bottom-right";

  @ApiProperty({ required: false, example: "2025-01" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  policyVersion?: string;

  @ApiProperty({ required: false, example: "/privacy" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  policyUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  analyticsDescription?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  marketingDescription?: string;

  @ApiProperty({ required: false, example: "#0b5" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(9)
  accentColor?: string;
}

/** Per-site data-retention windows (drives the worker's daily purge job). */
export class UpdateRetentionConfigDto {
  @ApiProperty({ required: false, description: "Purge analytics_events older than N days.", example: 400 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  rawEventRetentionDays?: number;

  @ApiProperty({ required: false, description: "Anonymize identity PII not seen for N days (0 = never).", example: 730 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  piiRetentionDays?: number;
}

/**
 * The @Public consent-log beacon body (host-resolved). Best-effort proof-of-
 * consent; the client `ob_consent` cookie remains the live gate.
 */
export class ConsentLogDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  visitorId?: string;

  @ApiProperty()
  @IsBoolean()
  analytics!: boolean;

  @ApiProperty()
  @IsBoolean()
  marketing!: boolean;

  @ApiProperty({ required: false, enum: ["accept_all", "reject", "custom"] })
  @IsOptional()
  @IsIn(["accept_all", "reject", "custom"])
  method?: "accept_all" | "reject" | "custom";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  policyVersion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  path?: string;
}

import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

/** BCP-47-ish short locale code: lowercase, e.g. "en", "es", "pt-br", "zh-hans". */
export const LOCALE_CODE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;

/**
 * PUT /sites/:siteId/locales — i18n (B13). Replaces the site's locale set.
 * `defaultLocale` is served WITHOUT a URL prefix; `locales` is the full set
 * (the service guarantees `defaultLocale` is always included).
 */
export class UpdateLocalesDto {
  @ApiProperty({ example: "en", description: "Canonical locale (no URL prefix)." })
  @Transform(lower)
  @IsString()
  @Matches(LOCALE_CODE, { message: "defaultLocale must be a locale code like 'en' or 'pt-br'" })
  defaultLocale!: string;

  @ApiProperty({ type: [String], example: ["en", "es"] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === "string" ? v.trim().toLowerCase() : v))
      : value,
  )
  @IsString({ each: true })
  @Matches(LOCALE_CODE, { each: true, message: "each locale must be a code like 'en' or 'pt-br'" })
  locales!: string[];
}

/**
 * Site Settings hub DTOs (backlog #32 integrations + #31 CDN).
 *
 * Scripts are admin-authored (site_admin+) — lower risk than visitor input, but
 * still length-capped here so a runaway paste can't bloat the row or the public
 * `/api/v1/public/site` envelope. The service mirrors GA4/chat ids into the legacy
 * columns for back-compat.
 */

const MAX_SCRIPT = 20000;

export class UpdateIntegrationsDto {
  @ApiProperty({ required: false, example: "G-XXXXXXXXXX" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  ga4MeasurementId?: string;

  @ApiProperty({ required: false, example: "GTM-XXXXXXX" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  gtmId?: string;

  @ApiProperty({ required: false, description: "Live-chat widget id (Tawk.to or similar)" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  liveChatId?: string;

  @ApiProperty({
    required: false,
    description: "Raw HTML injected into <head> on every page (admin-trusted).",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_SCRIPT)
  headScripts?: string;

  @ApiProperty({
    required: false,
    description: "Raw HTML injected at end-of-<body> on every page (admin-trusted).",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_SCRIPT)
  bodyScripts?: string;
}

export class CdnRuleDto {
  @ApiProperty({ example: "/blog/*" })
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  pattern!: string;

  @ApiProperty({ example: 3600 })
  @IsInt()
  @Min(0)
  @Max(31536000)
  ttl!: number;
}

export class UpdateCdnDto {
  @ApiProperty({ required: false, example: 300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(31536000)
  defaultTtlSeconds?: number;

  @ApiProperty({ required: false, type: [CdnRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CdnRuleDto)
  rules?: CdnRuleDto[];
}

export class CachePurgeDto {
  @ApiProperty({ required: false, enum: ["all", "path"], default: "all" })
  @IsOptional()
  @IsString()
  scope?: "all" | "path";

  @ApiProperty({ required: false, example: "/pricing" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  path?: string;
}

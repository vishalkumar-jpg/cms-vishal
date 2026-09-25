import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export const EVENT_TYPES = ["pageview", "web-vitals", "event"] as const;
export const WEB_VITALS_METRICS = ["LCP", "CLS", "INP"] as const;
export const DEVICE_TYPES = ["desktop", "mobile", "tablet"] as const;

/** UTM fields carried on a beacon (optional, no PII). */
export class CollectUtmDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  source?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  medium?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  campaign?: string;
}

/** One event in a `/api/collect` beacon batch. */
export class CollectEventDto {
  @ApiProperty({ enum: EVENT_TYPES })
  @IsIn(EVENT_TYPES as unknown as string[])
  type!: string;

  @ApiProperty({ example: "/pricing" })
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  path!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  referrer?: string;

  @ApiProperty({ required: false, type: CollectUtmDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CollectUtmDto)
  utm?: CollectUtmDto;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  visitorId!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  sessionId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20000)
  screenW?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20000)
  screenH?: number;

  @ApiProperty({ required: false, enum: DEVICE_TYPES })
  @IsOptional()
  @IsIn(DEVICE_TYPES as unknown as string[])
  deviceType?: string;

  @ApiProperty({ required: false, enum: WEB_VITALS_METRICS })
  @IsOptional()
  @IsIn(WEB_VITALS_METRICS as unknown as string[])
  metric?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({
    required: false,
    description: "Conversion label (Phase 5 attribution; for name=conversion events)",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  label?: string;

  @ApiProperty({ required: false, description: "A/B experiment id (exposure/conversion events)" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  experimentId?: string;

  @ApiProperty({ required: false, description: "Assigned variant key (A/B/…)" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  variant?: string;
}

/** Batch beacon payload posted by the renderer tracker. */
export class CollectDto {
  @ApiProperty({ type: [CollectEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectEventDto)
  events!: CollectEventDto[];
}

/** Shared from/to range for the stats endpoints (defaults: last 28 days). */
export class RangeQueryDto {
  @ApiProperty({ required: false, example: "2026-06-01", description: "YYYY-MM-DD (inclusive)" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10)
  from?: string;

  @ApiProperty({ required: false, example: "2026-06-28", description: "YYYY-MM-DD (inclusive)" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10)
  to?: string;
}

export class TimeseriesQueryDto extends RangeQueryDto {
  @ApiProperty({ required: false, enum: ["day"], default: "day" })
  @IsOptional()
  @IsIn(["day"])
  interval?: string;
}

export class PagesQueryDto extends RangeQueryDto {
  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

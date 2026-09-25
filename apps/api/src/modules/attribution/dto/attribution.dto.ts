import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** The supported attribution models. */
export const ATTRIBUTION_MODELS = ["first", "last", "linear", "position"] as const;
export type AttributionModel = (typeof ATTRIBUTION_MODELS)[number];

/** Shared from/to range + model for the attribution reads (defaults: last 28d, last-touch). */
export class AttributionQueryDto {
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

  @ApiProperty({ required: false, enum: ATTRIBUTION_MODELS, default: "last" })
  @IsOptional()
  @IsIn(ATTRIBUTION_MODELS as unknown as string[])
  model?: AttributionModel;
}

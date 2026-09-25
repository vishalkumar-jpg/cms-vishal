import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { RULE_FIELDS, RULE_OPERATORS } from "../rules";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

const RULE_FIELD_NAMES = RULE_FIELDS.map((f) => f.name);

/** Public identify payload (host-resolved): links an email to a visitorId. */
export class IdentifyDto {
  @ApiProperty({ example: "vis_ab12", description: "First-party analytics visitorId" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  visitorId!: string;

  @ApiProperty({ example: "jane@acme.com" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ required: false, example: "Jane Doe" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  name?: string;
}

/** List query for the visitors table. */
export class VisitorsQueryDto {
  @ApiProperty({ required: false, enum: ["score", "lastSeen", "pageviews"], default: "score" })
  @IsOptional()
  @IsIn(["score", "lastSeen", "pageviews"])
  sort?: string;

  @ApiProperty({ required: false, description: "Only identified visitors when true" })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === "true")
  @IsBoolean()
  identified?: boolean;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

/** A single scoring-rule condition. */
export class ScoringConditionDto {
  @ApiProperty({ enum: RULE_FIELD_NAMES })
  @IsIn(RULE_FIELD_NAMES)
  field!: string;

  @ApiProperty({ enum: RULE_OPERATORS })
  @IsIn(RULE_OPERATORS as unknown as string[])
  op!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  value?: string | number | boolean;
}

export class ScoringRuleDto {
  @ApiProperty({ example: "Engaged: 5+ pageviews" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ type: ScoringConditionDto })
  @IsObject()
  @Type(() => ScoringConditionDto)
  condition!: ScoringConditionDto;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  points!: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value !== false && value !== "false")
  @IsBoolean()
  active?: boolean;
}

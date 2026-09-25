import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { EXPERIMENT_STATUSES, GOAL_TYPES } from "@database/schema";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** One variant arm on create/update. */
export class ExperimentVariantDto {
  @ApiProperty({ example: "A" })
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  key!: string;

  @ApiProperty({ example: "Control" })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ default: 1, description: "Relative traffic weight (>=1)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  weight?: number;

  @ApiProperty({ default: false })
  @IsOptional()
  @IsBoolean()
  isControl?: boolean;
}

/** Create/update an experiment (variants replace the full set). */
export class ExperimentDto {
  @ApiProperty({ example: "Homepage hero test" })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false, description: "Optional target page id" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  pageId?: string;

  @ApiProperty({ enum: GOAL_TYPES, default: "pageview" })
  @IsOptional()
  @IsIn(GOAL_TYPES as unknown as string[])
  goalType?: string;

  @ApiProperty({ required: false, description: "For goalType=pageview: converting path" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  goalPath?: string;

  @ApiProperty({ type: [ExperimentVariantDto], description: "At least 2 variants" })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ExperimentVariantDto)
  variants!: ExperimentVariantDto[];
}

/** Change an experiment's lifecycle status. */
export class ExperimentStatusDto {
  @ApiProperty({ enum: EXPERIMENT_STATUSES })
  @IsIn(EXPERIMENT_STATUSES as unknown as string[])
  status!: string;

  @ApiProperty({ required: false, description: "Winner variant id (when marking done)" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  winnerVariantId?: string;
}

import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import type { RuleGroup } from "@modules/identity/rules";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/**
 * An audience is defined by a condition GROUP (AND/OR tree) over profile/identity
 * fields. We accept it as a JSON object (validated structurally in the service —
 * class-validator can't validate a recursive tree cheaply) and persist it as-is.
 */
export class AudienceDto {
  @ApiProperty({ example: "High-intent accounts" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: "Condition group: { logic: 'and'|'or', conditions: [...] }",
    example: { logic: "and", conditions: [{ field: "score", op: "gte", value: 10 }] },
  })
  @IsObject()
  rules!: RuleGroup;
}

/** Preview a rule set → a match count (no persistence). */
export class AudiencePreviewDto {
  @ApiProperty({ description: "Condition group to evaluate" })
  @IsObject()
  rules!: RuleGroup;
}

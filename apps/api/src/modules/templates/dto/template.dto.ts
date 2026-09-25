import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class CreateTemplateDto {
  @ApiProperty({ example: "Hero + features" })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false, enum: ["page", "section"], default: "page" })
  @IsOptional()
  @IsIn(["page", "section"])
  kind?: string;

  @ApiProperty({ description: "SerializedLayout fragment to insert in the builder" })
  @IsObject()
  layout!: Record<string, unknown>;
}

export class ListTemplatesQueryDto {
  @ApiProperty({ required: false, enum: ["page", "section"] })
  @IsOptional()
  @IsIn(["page", "section"])
  kind?: string;
}

export class UpdateTemplateDto {
  @ApiProperty({ example: "Hero + features (updated)" })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}

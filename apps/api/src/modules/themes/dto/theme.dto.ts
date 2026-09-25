import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class UpdateThemeDto {
  @ApiProperty({ required: false, example: "default" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  preset?: string;

  @ApiProperty({ required: false, description: "Design tokens (colors/spacing/typography)" })
  @IsOptional()
  @IsObject()
  tokens?: Record<string, unknown>;

  @ApiProperty({ required: false, description: "Brand metadata (logo, name, ...)" })
  @IsOptional()
  @IsObject()
  brand?: Record<string, unknown>;
}

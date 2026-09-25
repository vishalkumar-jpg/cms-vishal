import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class CreateOrganizationDto {
  @ApiProperty({ example: "OfficeBeacon" })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: "officebeacon" })
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/, {
    message: "slug must be lowercase alphanumeric with hyphens",
  })
  slug!: string;
}

export class UpdateOrganizationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false, enum: ["active", "suspended", "archived"] })
  @IsOptional()
  @IsString()
  status?: string;
}

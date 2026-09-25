import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsHexColor,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { SITE_VISIBILITY } from "@ob-cms/shared";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/;

export class CreateSiteDto {
  @ApiProperty({
    required: false,
    example: "org_...",
    description:
      "Organization to own the site. Omit to auto-resolve: the caller's org (from their memberships), else the platform's only active org.",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  orgId?: string;

  @ApiProperty({ example: "OfficeBeacon Marketing" })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: "officebeacon" })
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug!: string;

  @ApiProperty({ example: "officebeacon" })
  @Transform(lower)
  @Matches(SLUG, { message: "subdomain must be lowercase alphanumeric with hyphens" })
  subdomain!: string;

  @ApiProperty({ required: false, description: "Owner userId; defaults to the creator" })
  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class UpdateSiteDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false, enum: SITE_VISIBILITY })
  @IsOptional()
  @IsIn(SITE_VISIBILITY as unknown as string[])
  visibility?: string;

  @ApiProperty({ required: false, enum: ["active", "suspended"] })
  @IsOptional()
  @IsIn(["active", "suspended"])
  status?: string;
}

export class UpdateSiteSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  tagline?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  ga4TrackingId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  socialLinkedin?: string;
}

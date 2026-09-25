import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

/**
 * HubSpot import DTOs. The private-app token is accepted per request and NEVER
 * persisted — it lives only for the lifetime of the call (see HUBSPOT-IMPORT.md).
 */

export class HubspotPreviewDto {
  @ApiProperty({ description: "HubSpot private-app access token (never stored)" })
  @IsString()
  @MinLength(8)
  @MaxLength(400)
  token!: string;
}

export class HubspotRunDto {
  @ApiProperty({ description: "HubSpot private-app access token (never stored)" })
  @IsString()
  @MinLength(8)
  @MaxLength(400)
  token!: string;

  @ApiProperty({ type: [String], description: "HubSpot CMS page ids to import" })
  @IsArray()
  @IsString({ each: true })
  pageIds: string[] = [];

  @ApiProperty({ type: [String], description: "HubSpot blog post ids to import" })
  @IsArray()
  @IsString({ each: true })
  postIds: string[] = [];
}

/** One item of an offline HubSpot export array. */
export class HubspotExportItemDto {
  @ApiProperty({ example: "About Us" })
  @IsString()
  @MaxLength(500)
  name!: string;

  @ApiProperty({ required: false, example: "about-imported" })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @ApiProperty({ example: "<h1>About</h1>" })
  @IsString()
  html!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  metaDescription?: string;

  @ApiProperty({ required: false, description: "Import as a blog post instead of a page" })
  @IsOptional()
  @IsString()
  type?: "page" | "post";
}

export class HubspotRunExportDto {
  @ApiProperty({ type: [HubspotExportItemDto], description: "HubSpot export JSON array" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HubspotExportItemDto)
  items: HubspotExportItemDto[] = [];
}

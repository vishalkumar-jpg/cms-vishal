import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/;

/**
 * Create-site payload for the PLATFORM console. Unlike the site-scoped
 * `CreateSiteDto`, `orgId` is optional — the platform service resolves (or
 * creates) a default organization so a super-admin can spin up a tenant with
 * just a name + subdomain.
 */
export class PlatformCreateSiteDto {
  @ApiProperty({ example: "Acme Marketing" })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: "acme" })
  @Transform(lower)
  @Matches(SLUG, { message: "subdomain must be lowercase alphanumeric with hyphens" })
  subdomain!: string;

  @ApiProperty({ required: false, example: "acme", description: "Defaults to the subdomain." })
  @IsOptional()
  @Transform(lower)
  @Matches(SLUG, { message: "slug must be lowercase alphanumeric with hyphens" })
  slug?: string;

  @ApiProperty({ required: false, description: "Organization id; resolved/created if omitted." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  orgId?: string;
}

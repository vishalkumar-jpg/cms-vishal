import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** A path must start with "/" and contain no whitespace or protocol. */
const PATH = /^\/[^\s]*$/;
/**
 * A redirect DESTINATION may be a site-relative path OR an absolute http(s) URL,
 * but never a `javascript:`/`data:`/`vbscript:` scheme — that would put an XSS
 * sink in the Location header. Whitespace is disallowed (header-injection guard).
 */
const DEST = /^(\/[^\s]*|https?:\/\/[^\s]+)$/i;
export const REDIRECT_CODES = [301, 302, 307, 308];

export class CreateRedirectDto {
  @ApiProperty({ example: "/old-page" })
  @Transform(trim)
  @Matches(PATH, { message: "fromPath must start with /" })
  @MaxLength(1000)
  fromPath!: string;

  @ApiProperty({ example: "/new-page" })
  @Transform(trim)
  @Matches(DEST, { message: "toPath must be a /path or an http(s) URL" })
  @MaxLength(1000)
  toPath!: string;

  @ApiProperty({ required: false, enum: REDIRECT_CODES, default: 301 })
  @IsOptional()
  @IsInt()
  @IsIn(REDIRECT_CODES)
  statusCode?: number;
}

export class UpdateRedirectDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @Matches(PATH, { message: "fromPath must start with /" })
  @MaxLength(1000)
  fromPath?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @Matches(DEST, { message: "toPath must be a /path or an http(s) URL" })
  @MaxLength(1000)
  toPath?: string;

  @ApiProperty({ required: false, enum: REDIRECT_CODES })
  @IsOptional()
  @IsInt()
  @IsIn(REDIRECT_CODES)
  statusCode?: number;
}

export class ImportRedirectsDto {
  @ApiProperty({ description: "CSV body with header: fromPath,toPath,statusCode" })
  @IsString()
  @MaxLength(1_000_000)
  csv!: string;
}

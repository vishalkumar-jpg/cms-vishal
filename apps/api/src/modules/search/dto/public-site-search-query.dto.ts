import { ApiPropertyOptional } from "@nestjs/swagger";
import { Allow, IsOptional, IsString } from "class-validator";

/** Query params for public on-site search (all optional at runtime; defaults applied in controller). */
export class PublicSiteSearchQueryDto {
  @ApiPropertyOptional({ description: "Search query text" })
  @Allow()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: "Content type filter" })
  @Allow()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: "Max results (HTTP query string, parsed server-side)" })
  @Allow()
  @IsOptional()
  @IsString()
  limit?: string;
}

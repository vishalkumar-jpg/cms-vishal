import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  TEMPLATE_CATALOG_SORT_VALUES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_STATUSES,
} from "@ob-cms/template-registry";
import { Allow, IsOptional } from "class-validator";

/**
 * HTTP query filters for catalog listing.
 * Shape validation is delegated to {@link parseTemplateCatalogQuery} in the service.
 */
export class ListTemplateCatalogQueryDto {
  @ApiPropertyOptional({ enum: TEMPLATE_CATEGORIES })
  @Allow()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ enum: TEMPLATE_STATUSES })
  @Allow()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: "Filter by supported page type id" })
  @Allow()
  @IsOptional()
  pageType?: string;

  @ApiPropertyOptional({
    type: [String],
    description: "Match catalog entries tagged with all listed tags",
  })
  @Allow()
  @IsOptional()
  tags?: string | string[];

  @ApiPropertyOptional({
    description: "Free-text search across template key, display name, and description",
  })
  @Allow()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({ description: "Filter by featured shelf flag in preview metadata" })
  @Allow()
  @IsOptional()
  featured?: boolean;

  @ApiPropertyOptional({
    description: "Include preview asset summaries in each catalog entry",
    default: false,
  })
  @Allow()
  @IsOptional()
  includeAssets?: boolean;

  @ApiPropertyOptional({
    enum: TEMPLATE_CATALOG_SORT_VALUES,
    default: "displayName",
    description: "Sort order for catalog listing",
  })
  @Allow()
  @IsOptional()
  sort?: string;
}

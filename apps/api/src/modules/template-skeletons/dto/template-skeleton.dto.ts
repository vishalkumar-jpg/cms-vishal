import { ApiPropertyOptional } from "@nestjs/swagger";
import { TEMPLATE_CATEGORIES, TEMPLATE_STATUSES } from "@ob-cms/template-registry";
import { Allow, IsOptional } from "class-validator";

/**
 * HTTP query filters for skeleton listing.
 * Shape validation is delegated to {@link parseTemplateSkeletonListQuery} in the service.
 */
export class ListTemplateSkeletonsQueryDto {
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
    description: "Match skeletons tagged with all listed tags",
  })
  @Allow()
  @IsOptional()
  tags?: string | string[];

  @ApiPropertyOptional({ description: "Free-text search across display name and description" })
  @Allow()
  @IsOptional()
  query?: string;
}

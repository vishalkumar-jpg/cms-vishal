import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, ValidateIf } from "class-validator";
import type { SerializedLayout } from "@ob-cms/block-schema";

/**
 * Update the site's global chrome (GLOBAL-CHROME). Both fields optional so a
 * caller can save just the header or just the footer. A field set to `null`
 * explicitly clears that slot (renderer then injects nothing). Each provided
 * layout is validated/repaired through @ob-cms/block-schema in the service.
 */
export class UpdateSiteChromeDto {
  @ApiProperty({
    required: false,
    nullable: true,
    description: "Header SerializedLayout, or null to clear the header.",
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  header?: SerializedLayout | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: "Footer SerializedLayout, or null to clear the footer.",
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  footer?: SerializedLayout | null;
}

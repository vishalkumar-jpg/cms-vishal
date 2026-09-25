import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type {
  ComponentProp,
  ComponentVariant,
  SerializedLayout,
} from "@ob-cms/block-schema";

/**
 * Create a reusable block (REUSE-BLOCKS). `name` is required; `layout` is a
 * self-contained SerializedLayout fragment (own root) validated/repaired through
 * @ob-cms/block-schema in the service.
 */
export class CreateReusableBlockDto {
  @ApiProperty({ description: "Display name for the reusable block." })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: "SerializedLayout fragment (own root) to store." })
  @IsObject()
  layout!: SerializedLayout;

  @ApiProperty({ required: false, description: "COMPONENTS: declared editable props." })
  @IsOptional()
  @IsArray()
  props?: ComponentProp[];

  @ApiProperty({ required: false, description: "COMPONENTS: optional named prop-preset variants." })
  @IsOptional()
  @IsArray()
  variants?: ComponentVariant[];
}

/**
 * Update a reusable block. Both fields optional so a caller can rename without
 * resaving the layout, or vice versa. A provided layout is validated in the
 * service and saving purges the render cache so every instance re-resolves.
 */
export class UpdateReusableBlockDto {
  @ApiProperty({ required: false, description: "New display name." })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false, description: "New SerializedLayout fragment (own root)." })
  @IsOptional()
  @IsObject()
  layout?: SerializedLayout;

  @ApiProperty({ required: false, description: "COMPONENTS: declared editable props." })
  @IsOptional()
  @IsArray()
  props?: ComponentProp[];

  @ApiProperty({ required: false, description: "COMPONENTS: optional named prop-preset variants." })
  @IsOptional()
  @IsArray()
  variants?: ComponentVariant[];
}

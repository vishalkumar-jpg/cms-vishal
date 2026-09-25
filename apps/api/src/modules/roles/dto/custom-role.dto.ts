import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PERMISSIONS } from "@ob-cms/shared";

export class CreateCustomRoleDto {
  @ApiProperty({ description: "Role name, unique within the site" })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: PERMISSIONS, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSIONS as unknown as string[], { each: true })
  permissions!: string[];
}

export class UpdateCustomRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: PERMISSIONS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSIONS as unknown as string[], { each: true })
  permissions?: string[];
}

export class AssignCustomRoleDto {
  @ApiPropertyOptional({ description: "Custom role id (crl_...), or null to clear" })
  @IsOptional()
  @IsString()
  customRoleId?: string | null;
}

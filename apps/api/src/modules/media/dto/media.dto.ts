import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** Restrict MIME to a sane set (image/* , video/* , application/pdf). */
const MIME = /^(image|video|application|audio)\/[a-z0-9.+-]+$/i;

export class PresignUploadDto {
  @ApiProperty({ example: "hero.png" })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  filename!: string;

  @ApiProperty({ example: "image/png" })
  @Transform(trim)
  @Matches(MIME, { message: "invalid content type" })
  contentType!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}

export class ConfirmUploadDto {
  @ApiProperty({ description: "media id returned by /presign" })
  @IsString()
  mediaId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  width?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  height?: number;
}

/** Normalized focal point — x/y in [0,1]. */
export class FocalPointDto {
  @ApiProperty({ example: 0.5 })
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @ApiProperty({ example: 0.5 })
  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;
}

export class UpdateMediaDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  alt?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false, type: FocalPointDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FocalPointDto)
  focalPoint?: FocalPointDto;

  @ApiProperty({ required: false, description: "Folder to move the asset into (null = root)" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  folderId?: string | null;
}

/** POST /media/:id/crop — pixel rect relative to the intrinsic image. */
export class CropMediaDto {
  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  x!: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  y!: number;

  @ApiProperty({ example: 800 })
  @IsInt()
  @Min(1)
  w!: number;

  @ApiProperty({ example: 600 })
  @IsInt()
  @Min(1)
  h!: number;
}

/** POST /media/folders — create a folder. */
export class CreateFolderDto {
  @ApiProperty({ example: "Campaign assets" })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false, description: "Parent folder id (null = root)" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentId?: string | null;
}

/** PATCH /media/folders/:id — rename / re-parent a folder. */
export class UpdateFolderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false, description: "New parent (null = root)" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentId?: string | null;
}

/** POST /media/move — move a set of assets into a folder (null = root). */
export class MoveMediaDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  mediaIds!: string[];

  @ApiProperty({ required: false, description: "Destination folder id (null = root)" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  folderId?: string | null;
}

export class ListMediaQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  tag?: string;

  @ApiProperty({
    required: false,
    description: "Filter to a folder. Omit = all; 'root' = unfiled (folderId IS NULL).",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  folderId?: string;
}

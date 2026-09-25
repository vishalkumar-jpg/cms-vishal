import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** A comment thread is either anchored to a Craft node OR to a canvas point. */
export class CreateCommentDto {
  @ApiProperty({ example: "pge_123", description: "The page the comment belongs to." })
  @Matches(/^[a-z0-9_]+$/i, { message: "pageId is malformed" })
  @MaxLength(50)
  pageId!: string;

  @ApiProperty({ required: false, description: "Craft node id the pin anchors to." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nodeId?: string;

  @ApiProperty({ required: false, description: "Canvas anchor X (0..1 fraction)." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  anchorX?: number;

  @ApiProperty({ required: false, description: "Canvas anchor Y (0..1 fraction)." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  anchorY?: number;

  @ApiProperty({ example: "This heading should be shorter." })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class ReplyCommentDto {
  @ApiProperty({ example: "Agreed — will trim it." })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class ResolveCommentDto {
  @ApiProperty({ description: "true to resolve the thread, false to reopen." })
  resolved!: boolean;
}

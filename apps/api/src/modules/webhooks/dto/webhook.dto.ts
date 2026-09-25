import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";
import { WEBHOOK_EVENTS } from "../webhook-events";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class CreateWebhookDto {
  @ApiProperty({ example: "https://example.com/hooks/ob-cms" })
  @Transform(trim)
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(1000)
  url!: string;

  @ApiProperty({ enum: WEBHOOK_EVENTS, isArray: true, example: ["page.published"] })
  @IsArray()
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENTS as unknown as string[], { each: true })
  events!: string[];

  @ApiProperty({ required: false, description: "HMAC secret; auto-generated if omitted." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  secret?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateWebhookDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(1000)
  url?: string;

  @ApiProperty({ required: false, enum: WEBHOOK_EVENTS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENTS as unknown as string[], { each: true })
  events?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  secret?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

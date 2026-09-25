import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsObject, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/**
 * Public submission payload. We accept an arbitrary `data` bag (validated
 * server-side against the FORM's persisted field schema — never trust the
 * client's idea of the shape) plus the honeypot + render timestamp for spam
 * heuristics. Body size is additionally capped by the controller.
 */
export class SubmitFormDto {
  @ApiProperty({ description: "field name -> value map" })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiProperty({ required: false, description: "honeypot — must be empty" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  _hp?: string;

  @ApiProperty({ required: false, description: "client render time (unix ms) for timing check" })
  @IsOptional()
  renderedAt?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  utm?: Record<string, unknown>;

  @ApiProperty({ required: false, description: "Cloudflare Turnstile token (when captcha is on)" })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  captchaToken?: string;

  @ApiProperty({
    required: false,
    description: "First-party analytics visitorId (Phase 3 identity link, best-effort)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  visitorId?: string;
}

/** Presign request for a FORM file-upload field (public, host-resolved). */
export class FormUploadPresignDto {
  @ApiProperty({ example: "resume.pdf" })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  filename!: string;

  @ApiProperty({ example: "application/pdf" })
  @Transform(trim)
  @IsString()
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: "invalid content type" })
  @MaxLength(120)
  contentType!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}

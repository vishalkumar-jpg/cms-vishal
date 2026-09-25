import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";
import { PROVIDERS, type AiProvider } from "@database/schema";
import { TEXT_OPS, TONES, type TextOp, type Tone } from "../text-ops";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** Set/replace a BYOK provider key (stored encrypted). */
export class SetAiKeyDto {
  @ApiProperty({ enum: PROVIDERS, example: "claude" })
  @IsIn(PROVIDERS as unknown as string[])
  provider!: AiProvider;

  @ApiProperty({ description: "The plaintext API key (encrypted at rest; never returned)." })
  @Transform(trim)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  apiKey!: string;

  @ApiProperty({ required: false, description: "Optional human label for the key." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  label?: string;
}

/** Enqueue a page generation. */
export class GenerateDto {
  @ApiProperty({ example: "A landing page for a B2B SaaS analytics product" })
  @Transform(trim)
  @IsString()
  @MinLength(4)
  @MaxLength(8000)
  prompt!: string;

  @ApiProperty({ required: false, enum: PROVIDERS, description: "Defaults to AI_DEFAULT_PROVIDER (claude)." })
  @IsOptional()
  @IsIn(PROVIDERS as unknown as string[])
  provider?: AiProvider;

  @ApiProperty({ required: false, description: "Override the model; defaults to the provider's recommended model." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  model?: string;

  @ApiProperty({ required: false, description: "Update this page's draft instead of creating a new one." })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetPageId?: string;
}

/** Refine an existing page's draft layout with a natural-language instruction. */
export class RefineDto {
  @ApiProperty({ description: "The page whose draft layout to modify." })
  @IsString()
  @MaxLength(50)
  pageId!: string;

  @ApiProperty({ example: "Make the hero headline shorter and add a pricing section" })
  @Transform(trim)
  @IsString()
  @MinLength(4)
  @MaxLength(8000)
  instruction!: string;

  @ApiProperty({ required: false, enum: PROVIDERS })
  @IsOptional()
  @IsIn(PROVIDERS as unknown as string[])
  provider?: AiProvider;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  model?: string;
}

/** In-canvas text transform (rewrite/shorten/expand/…). SYNC — returns { text }. */
export class TextOpDto {
  @ApiProperty({ enum: TEXT_OPS, example: "rewrite" })
  @IsIn(TEXT_OPS as unknown as string[])
  op!: TextOp;

  @ApiProperty({ example: "Build pages with AI" })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  @ApiProperty({ required: false, enum: TONES, description: "Required for op=change-tone." })
  @IsOptional()
  @IsIn(TONES as unknown as string[])
  tone?: Tone;

  @ApiProperty({ required: false, example: "Spanish", description: "Required for op=translate." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  targetLang?: string;

  @ApiProperty({ required: false, enum: PROVIDERS })
  @IsOptional()
  @IsIn(PROVIDERS as unknown as string[])
  provider?: AiProvider;
}

/** Generate concise alt text for an image. SYNC — returns { altText }. */
export class AltTextDto {
  @ApiProperty({ example: "https://cdn.example.com/hero.png" })
  @Transform(trim)
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl!: string;

  @ApiProperty({ required: false, enum: PROVIDERS })
  @IsOptional()
  @IsIn(PROVIDERS as unknown as string[])
  provider?: AiProvider;
}

/** Generate a single page section subtree from a prompt. SYNC — returns a layout. */
export class SectionDto {
  @ApiProperty({ example: "A pricing section with three tiers" })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt!: string;

  @ApiProperty({ required: false, description: "Optional surrounding-page context for cohesion." })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  context?: string;

  @ApiProperty({ required: false, enum: PROVIDERS })
  @IsOptional()
  @IsIn(PROVIDERS as unknown as string[])
  provider?: AiProvider;
}

import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/**
 * A DSAR subject query — either an email address or a first-party visitorId.
 * The service auto-detects which (an `@` ⇒ email) and resolves email→identity→
 * visitorIds so both entry points reach the same rows.
 */
export class SubjectQueryDto {
  @ApiProperty({ example: "jane@acme.com", description: "An email or a visitorId." })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  query!: string;
}

import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Matches, MaxLength } from "class-validator";

const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

/**
 * A bare hostname: lowercase labels separated by dots, no scheme/port/path.
 * Rejects `http://`, trailing slashes, wildcards and whitespace (so it can be
 * used directly as a Host match + a DNS lookup target).
 */
const HOSTNAME = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?:\.(?!-)[a-z0-9-]{1,63})+$/;

export class CreateDomainDto {
  @ApiProperty({ example: "www.acme.com", description: "Bare hostname to bind to this site" })
  @Transform(lower)
  @Matches(HOSTNAME, { message: "domain must be a bare hostname like www.acme.com" })
  @MaxLength(255)
  domain!: string;
}

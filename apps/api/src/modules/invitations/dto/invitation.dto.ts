import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ROLES } from "@ob-cms/shared";

const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** Invite a teammate by email + the role they'll receive on accept. */
export class CreateInvitationDto {
  @ApiProperty({ example: "teammate@company.com" })
  @Transform(lower)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES as unknown as string[])
  role!: string;
}

/** Public accept body — name/password only needed when the user is brand new. */
export class AcceptInvitationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false, description: "Required only if no account exists yet" })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password?: string;
}

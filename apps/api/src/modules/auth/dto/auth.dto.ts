import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const trimLower = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class SignupDto {
  @ApiProperty({ example: "user@example.com" })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 8, example: "S3curePass!" })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @ApiProperty({ required: false, example: "Jane Doe" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  password!: string;

  @ApiProperty({ required: false, example: "123456", description: "TOTP code if 2FA is enabled" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10)
  totp?: string;

  @ApiProperty({
    required: false,
    example: "a1b2-c3d4-e5",
    description: "A single-use backup recovery code (alternative to `totp`)",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  backupCode?: string;
}

/** 6-digit TOTP code (RFC 6238). */
export class TotpCodeDto {
  @ApiProperty({ example: "123456" })
  @Transform(trim)
  @IsString()
  @MaxLength(10)
  code!: string;
}

/** Disable 2FA: a current TOTP code OR the account password. */
export class DisableTotpDto {
  @ApiProperty({ required: false, example: "123456" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10)
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}

/** Regenerate backup codes: re-verify with a current TOTP code OR the password. */
export class RegenerateBackupCodesDto {
  @ApiProperty({ required: false, example: "123456" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10)
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: "user@example.com" })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

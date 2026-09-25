import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import responseUtils from "@utils/response.utils";
import { Public } from "@common/decorators/public.decorator";
import { RateLimit } from "@common/decorators/rate-limit.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { rateLimitConfig } from "@config/rate-limit.config";
import { authConfig } from "@config/auth.config";
import { AuthService, type IssuedSession } from "./auth.service";
import { clearSessionCookie, setRefreshCookie, setSessionCookie } from "./cookie.util";
import {
  DisableTotpDto,
  ForgotPasswordDto,
  LoginDto,
  RegenerateBackupCodesDto,
  ResetPasswordDto,
  SignupDto,
  TotpCodeDto,
} from "./dto/auth.dto";

/** Local email/password auth (JWT access cookie + rotating refresh cookie). */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Write both auth cookies from an issued session. */
  private setSessionCookies(res: Response, session: IssuedSession): void {
    setSessionCookie(res, session.token);
    setRefreshCookie(res, session.refreshToken);
  }

  @Public()
  @Post("signup")
  @RateLimit({ ...rateLimitConfig.buckets.auth, keyBy: "ip", name: "auth" })
  @ApiOperation({ summary: "Register a local user; sets the session + refresh cookies" })
  async signup(@Body() dto: SignupDto, @Res() res: Response): Promise<Response> {
    const session = await this.auth.signup(dto);
    this.setSessionCookies(res, session);
    return responseUtils.success(res, { data: session.user, status: StatusCodes.CREATED });
  }

  @Public()
  @Post("login")
  @RateLimit({ ...rateLimitConfig.buckets.auth, keyBy: "ip", name: "auth" })
  @ApiOperation({ summary: "Log in (TOTP required if 2FA on); sets session + refresh cookies" })
  async login(@Body() dto: LoginDto, @Res() res: Response): Promise<Response> {
    const session = await this.auth.login(dto);
    this.setSessionCookies(res, session);
    return responseUtils.success(res, { data: session.user });
  }

  /**
   * Rotate the refresh cookie and issue a fresh access cookie. @Public so the
   * (expired) access token is not required — the refresh cookie itself is the
   * credential. Being @Public also exempts it from the double-submit CSRF guard,
   * exactly like login; the refresh token's secrecy + SameSite=Lax are the
   * defenses here.
   */
  @Public()
  @Post("refresh")
  @RateLimit({ ...rateLimitConfig.buckets.auth, keyBy: "ip", name: "auth" })
  @ApiOperation({ summary: "Rotate refresh token; issue a fresh access cookie" })
  async refresh(@Req() req: Request, @Res() res: Response): Promise<Response> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[authConfig.refreshCookieName];
    const session = await this.auth.refresh(raw);
    this.setSessionCookies(res, session);
    return responseUtils.success(res, { data: session.user });
  }

  @Post("logout")
  @ApiOperation({ summary: "Clear both cookies + revoke the refresh token" })
  async logout(@Req() req: Request, @Res() res: Response): Promise<Response> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[authConfig.refreshCookieName];
    await this.auth.revokeRefreshToken(raw);
    clearSessionCookie(res);
    return responseUtils.success(res, { data: { ok: true } });
  }

  @Get("me")
  @ApiOperation({ summary: "Current user + memberships + isPlatformAdmin + totpEnabled" })
  async me(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<Response> {
    const data = await this.auth.me(user.userId);
    return responseUtils.success(res, { data });
  }

  // -- 2FA (TOTP) ----------------------------------------------------------

  @Post("2fa/setup")
  @ApiOperation({ summary: "Generate a TOTP secret + otpauth URL (not yet enabled)" })
  async setup2fa(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<Response> {
    const data = await this.auth.setupTwoFactor(user.userId);
    return responseUtils.success(res, { data });
  }

  @Post("2fa/enable")
  @ApiOperation({ summary: "Verify a TOTP code, enable 2FA, and return backup codes (shown once)" })
  async enable2fa(
    @CurrentUser() user: AuthUser,
    @Body() dto: TotpCodeDto,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.auth.enableTwoFactor(user.userId, dto.code);
    return responseUtils.success(res, { data });
  }

  @Post("2fa/backup-codes")
  @ApiOperation({ summary: "Regenerate backup codes (verify code or password); shown once" })
  async regenerateBackupCodes(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegenerateBackupCodesDto,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.auth.regenerateBackupCodes(user.userId, {
      code: dto.code,
      password: dto.password,
    });
    return responseUtils.success(res, { data });
  }

  @Post("2fa/disable")
  @ApiOperation({ summary: "Disable 2FA (verify a code or the password)" })
  async disable2fa(
    @CurrentUser() user: AuthUser,
    @Body() dto: DisableTotpDto,
    @Res() res: Response,
  ): Promise<Response> {
    await this.auth.disableTwoFactor(user.userId, { code: dto.code, password: dto.password });
    return responseUtils.success(res, { data: { ok: true } });
  }

  @Public()
  @Post("forgot-password")
  @RateLimit({ ...rateLimitConfig.buckets.auth, keyBy: "ip", name: "auth" })
  @ApiOperation({ summary: "Request a password reset (always 200, no enumeration)" })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Res() res: Response): Promise<Response> {
    await this.auth.forgotPassword(dto.email);
    return responseUtils.success(res, { data: { ok: true } });
  }

  @Public()
  @Post("reset-password")
  @RateLimit({ ...rateLimitConfig.buckets.auth, keyBy: "ip", name: "auth" })
  @ApiOperation({ summary: "Consume a reset token and set a new password" })
  async resetPassword(@Body() dto: ResetPasswordDto, @Res() res: Response): Promise<Response> {
    await this.auth.resetPassword(dto.token, dto.password);
    return responseUtils.success(res, { data: { ok: true } });
  }
}

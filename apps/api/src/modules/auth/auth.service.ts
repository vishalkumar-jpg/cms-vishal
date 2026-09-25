import { randomBytes, createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { and, eq, gt, isNull } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "@ob-cms/crypto";
import type { CurrentUser, JwtPayload } from "@ob-cms/shared";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  passwordResetTokens,
  refreshTokens,
  systemUsers,
  totpBackupCodes,
} from "@database/schema";
import { authConfig } from "@config/auth.config";
import { getOsEnv, getOsEnvOptional } from "@config/env.config";
import { PasswordService } from "@common/auth/password.service";
import { TokenService } from "@common/auth/token.service";
import {
  buildOtpAuthUri,
  generateTotpSecret,
  verifyTotp,
} from "@common/auth/totp.util";
import { qrSvgDataUri } from "@common/auth/qr.util";
import { MailService } from "@common/mail/mail.service";
import { MembershipService } from "@common/tenancy/membership.service";
import { AuditService } from "@common/audit/audit.service";
import type { LoginDto, SignupDto } from "./dto/auth.dto";

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** How many single-use recovery codes to mint per enable/regenerate. */
const BACKUP_CODE_COUNT = 10;
/** Unambiguous alphabet (no 0/O/1/I/L) for human-typable recovery codes. */
const BACKUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Normalize a backup code for hashing/compare (case-insensitive, no dashes/spaces). */
const normalizeBackupCode = (raw: string): string =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Generate one formatted backup code, e.g. `A1B2-C3D4-E5F6`. */
function generateBackupCode(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i += 1) {
    out += BACKUP_ALPHABET[bytes[i] % BACKUP_ALPHABET.length];
    if (i === 3 || i === 7) out += "-";
  }
  return out;
}

/** Session = short access JWT + opaque refresh token (raw, to be cookie'd). */
export interface IssuedSession {
  token: string;
  refreshToken: string;
  user: CurrentUser;
}

@Injectable()
export class AuthService {
  /** Data key for encrypting the TOTP secret at rest (mirrors EncryptionService). */
  private readonly encKey = getOsEnvOptional("ENCRYPTION_KEY") || getOsEnv("KMS_DATA_KEY");

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly membership: MembershipService,
    private readonly audit: AuditService,
  ) {}

  /** Sign up a new local user. Returns access + refresh tokens + payload. */
  async signup(dto: SignupDto): Promise<IssuedSession> {
    const [existing] = await this.db
      .select({ id: systemUsers.id })
      .from(systemUsers)
      .where(eq(systemUsers.email, dto.email))
      .limit(1);
    if (existing) throw new ConflictException("Unable to complete registration");

    const passwordHash = await this.passwords.hash(dto.password);
    const [created] = await this.db
      .insert(systemUsers)
      .values({ email: dto.email, passwordHash, name: dto.name ?? null })
      .returning();

    await this.audit.record({
      actorId: created.id,
      action: "user.registered",
      category: "sessions",
      entityType: "system_user",
      entityId: created.id,
    });

    return this.buildSession(created.id, created.email, created.isPlatformAdmin);
  }

  /**
   * Validate credentials and return a session. Generic error on failure. If the
   * user has 2FA enabled, a valid `totp` code is REQUIRED before any session is
   * issued (wrong/absent → 401).
   */
  async login(dto: LoginDto): Promise<IssuedSession> {
    const [user] = await this.db
      .select()
      .from(systemUsers)
      .where(and(eq(systemUsers.email, dto.email), isNull(systemUsers.deletedAt)))
      .limit(1);

    const ok = user?.passwordHash
      ? await this.passwords.compare(dto.password, user.passwordHash)
      : false;
    if (!user || !ok || user.status === "disabled") {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.totpEnabled) {
      const secret = this.decryptTotpSecret(user.totpSecret);
      if (dto.backupCode) {
        // A recovery code is an alternative to a TOTP: verify, mark used, allow.
        const remaining = await this.consumeBackupCode(user.id, dto.backupCode);
        if (remaining === null) {
          throw new UnauthorizedException("Invalid backup recovery code");
        }
        // (`remaining` is surfaced via the audit log; the SPA can show a hint.)
      } else if (dto.totp) {
        if (!secret || !verifyTotp(secret, dto.totp)) {
          throw new UnauthorizedException("Invalid two-factor authentication code");
        }
      } else {
        // Signal the SPA to collect a code, without leaking that the password
        // was correct beyond the 2FA challenge itself.
        throw new UnauthorizedException("Two-factor authentication code required");
      }
    }

    return this.buildSession(user.id, user.email, user.isPlatformAdmin);
  }

  /**
   * Validate a presented refresh token, ROTATE it (single-use), and issue a
   * fresh access + refresh pair. Reuse of an already-used token (theft signal)
   * revokes the user's whole chain.
   */
  async refresh(rawRefreshToken: string | undefined): Promise<IssuedSession> {
    if (!rawRefreshToken) throw new UnauthorizedException("No refresh token");
    const tokenHash = this.tokens.hashRefresh(rawRefreshToken);

    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!row || row.revokedAt || row.expiresAt <= new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    // Reuse detection: a token presented after rotation → revoke the whole chain.
    if (row.usedAt) {
      await this.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
      throw new UnauthorizedException("Refresh token already used");
    }

    const [user] = await this.db
      .select()
      .from(systemUsers)
      .where(and(eq(systemUsers.id, row.userId), isNull(systemUsers.deletedAt)))
      .limit(1);
    if (!user || user.status === "disabled") {
      throw new UnauthorizedException("Session is no longer valid");
    }

    // Mark the old token used (rotation) and mint a new one.
    await this.db
      .update(refreshTokens)
      .set({ usedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));

    return this.buildSession(user.id, user.email, user.isPlatformAdmin);
  }

  /** Revoke every outstanding refresh token for a user (logout). */
  async revokeRefreshTokens(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  /** Revoke a single refresh token by its raw value (best-effort on logout). */
  async revokeRefreshToken(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.tokens.hashRefresh(rawRefreshToken);
    const [row] = await this.db
      .select({ userId: refreshTokens.userId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    if (row) await this.revokeRefreshTokens(row.userId);
  }

  /** Current user + memberships + isPlatformAdmin (FND-7). */
  async me(userId: string): Promise<CurrentUser & { totpEnabled: boolean }> {
    const [user] = await this.db
      .select()
      .from(systemUsers)
      .where(and(eq(systemUsers.id, userId), isNull(systemUsers.deletedAt)))
      .limit(1);
    if (!user) throw new UnauthorizedException("Session is no longer valid");
    const current = await this.toCurrentUser(user.id, user.email, user.name, user.isPlatformAdmin);
    return { ...current, totpEnabled: user.totpEnabled };
  }

  // -- 2FA (TOTP) ----------------------------------------------------------

  /**
   * Begin 2FA enrollment: generate a fresh secret, store it ENCRYPTED but leave
   * `totpEnabled=false`. Returns the Base32 secret + otpauth URI for the SPA to
   * render as a QR code. Not active until `enableTwoFactor` verifies a code.
   */
  async setupTwoFactor(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string; qrDataUri: string }> {
    const [user] = await this.db
      .select()
      .from(systemUsers)
      .where(and(eq(systemUsers.id, userId), isNull(systemUsers.deletedAt)))
      .limit(1);
    if (!user) throw new UnauthorizedException("Session is no longer valid");
    if (user.totpEnabled) throw new BadRequestException("Two-factor is already enabled");

    const secret = generateTotpSecret();
    await this.db
      .update(systemUsers)
      .set({ totpSecret: encryptSecret(secret, this.encKey) })
      .where(eq(systemUsers.id, userId));

    const otpauthUrl = buildOtpAuthUri(secret, user.email);
    // Render the otpauth URI server-side as a scannable SVG QR (no admin dep).
    return { secret, otpauthUrl, qrDataUri: qrSvgDataUri(otpauthUrl) };
  }

  /**
   * Verify a TOTP code against the pending secret, flip 2FA on, and mint a fresh
   * set of single-use backup recovery codes. The RAW codes are returned exactly
   * once here (shown to the user); only their SHA-256 hashes are persisted.
   */
  async enableTwoFactor(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const [user] = await this.db
      .select()
      .from(systemUsers)
      .where(and(eq(systemUsers.id, userId), isNull(systemUsers.deletedAt)))
      .limit(1);
    if (!user) throw new UnauthorizedException("Session is no longer valid");
    if (user.totpEnabled) throw new BadRequestException("Two-factor is already enabled");

    const secret = this.decryptTotpSecret(user.totpSecret);
    if (!secret) throw new BadRequestException("Run 2FA setup first");
    if (!verifyTotp(secret, code)) {
      throw new UnauthorizedException("Invalid two-factor authentication code");
    }

    const backupCodes = await this.db.transaction(async (tx) => {
      await tx
        .update(systemUsers)
        .set({ totpEnabled: true })
        .where(eq(systemUsers.id, userId));
      const codes = await this.mintBackupCodes(userId, tx as unknown as Database);
      await this.audit.record(
        {
          actorId: userId,
          action: "user.2fa_enabled",
          category: "sessions",
          entityType: "system_user",
          entityId: userId,
          metadata: { backupCodesIssued: codes.length },
        },
        tx as unknown as Database,
      );
      return codes;
    });

    return { backupCodes };
  }

  /**
   * Regenerate backup codes: re-verify with a current TOTP code OR the account
   * password, invalidate the prior set, and return a fresh batch (shown once).
   */
  async regenerateBackupCodes(
    userId: string,
    opts: { code?: string; password?: string },
  ): Promise<{ backupCodes: string[] }> {
    const [user] = await this.db
      .select()
      .from(systemUsers)
      .where(and(eq(systemUsers.id, userId), isNull(systemUsers.deletedAt)))
      .limit(1);
    if (!user) throw new UnauthorizedException("Session is no longer valid");
    if (!user.totpEnabled) throw new BadRequestException("Two-factor is not enabled");

    const secret = this.decryptTotpSecret(user.totpSecret);
    const byCode = Boolean(opts.code && secret && verifyTotp(secret, opts.code));
    const byPassword = Boolean(
      opts.password &&
        user.passwordHash &&
        (await this.passwords.compare(opts.password, user.passwordHash)),
    );
    if (!byCode && !byPassword) {
      throw new UnauthorizedException("Provide a valid code or password to regenerate codes");
    }

    const backupCodes = await this.db.transaction(async (tx) => {
      const codes = await this.mintBackupCodes(userId, tx as unknown as Database);
      await this.audit.record(
        {
          actorId: userId,
          action: "user.2fa_backup_codes_regenerated",
          category: "sessions",
          entityType: "system_user",
          entityId: userId,
          metadata: { backupCodesIssued: codes.length },
        },
        tx as unknown as Database,
      );
      return codes;
    });

    return { backupCodes };
  }

  /**
   * Delete any existing backup codes for the user and insert a fresh batch,
   * returning the RAW codes (caller shows them once). Only hashes are stored.
   */
  private async mintBackupCodes(userId: string, db: Database): Promise<string[]> {
    await db.delete(totpBackupCodes).where(eq(totpBackupCodes.userId, userId));
    const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => generateBackupCode());
    await db.insert(totpBackupCodes).values(
      codes.map((c) => ({ userId, codeHash: sha256(normalizeBackupCode(c)) })),
    );
    return codes;
  }

  /**
   * Verify a presented backup code for a user against their UNUSED rows. On a
   * match it marks the row used (single-use) and returns the remaining count;
   * returns null when no unused code matches.
   */
  private async consumeBackupCode(userId: string, raw: string): Promise<number | null> {
    const hash = sha256(normalizeBackupCode(raw));
    const [row] = await this.db
      .select({ id: totpBackupCodes.id })
      .from(totpBackupCodes)
      .where(
        and(
          eq(totpBackupCodes.userId, userId),
          eq(totpBackupCodes.codeHash, hash),
          isNull(totpBackupCodes.usedAt),
        ),
      )
      .limit(1);
    if (!row) return null;

    await this.db
      .update(totpBackupCodes)
      .set({ usedAt: new Date() })
      .where(eq(totpBackupCodes.id, row.id));

    const remaining = await this.db
      .select({ id: totpBackupCodes.id })
      .from(totpBackupCodes)
      .where(and(eq(totpBackupCodes.userId, userId), isNull(totpBackupCodes.usedAt)));

    await this.audit.record({
      actorId: userId,
      action: "user.2fa_backup_code_used",
      category: "sessions",
      entityType: "system_user",
      entityId: userId,
      metadata: { remaining: remaining.length },
    });
    return remaining.length;
  }

  /** Disable 2FA after verifying a current TOTP code (or the password). */
  async disableTwoFactor(
    userId: string,
    opts: { code?: string; password?: string },
  ): Promise<void> {
    const [user] = await this.db
      .select()
      .from(systemUsers)
      .where(and(eq(systemUsers.id, userId), isNull(systemUsers.deletedAt)))
      .limit(1);
    if (!user) throw new UnauthorizedException("Session is no longer valid");
    if (!user.totpEnabled) throw new BadRequestException("Two-factor is not enabled");

    const secret = this.decryptTotpSecret(user.totpSecret);
    const byCode = Boolean(opts.code && secret && verifyTotp(secret, opts.code));
    const byPassword = Boolean(
      opts.password && user.passwordHash && (await this.passwords.compare(opts.password, user.passwordHash)),
    );
    if (!byCode && !byPassword) {
      throw new UnauthorizedException("Provide a valid code or password to disable 2FA");
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(systemUsers)
        .set({ totpEnabled: false, totpSecret: null })
        .where(eq(systemUsers.id, userId));
      // Disabling 2FA also clears every backup recovery code.
      await tx.delete(totpBackupCodes).where(eq(totpBackupCodes.userId, userId));
      await this.audit.record(
        {
          actorId: userId,
          action: "user.2fa_disabled",
          category: "sessions",
          entityType: "system_user",
          entityId: userId,
        },
        tx as unknown as Database,
      );
    });
  }

  /**
   * Begin a password reset. ALWAYS resolves (no user enumeration). If the email
   * exists, a single-use hashed token is stored and emailed (MailHog locally).
   */
  async forgotPassword(email: string): Promise<void> {
    const [user] = await this.db
      .select({ id: systemUsers.id, email: systemUsers.email })
      .from(systemUsers)
      .where(and(eq(systemUsers.email, email), isNull(systemUsers.deletedAt)))
      .limit(1);
    if (!user) return; // silent — no enumeration

    const raw = randomBytes(32).toString("hex");
    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + authConfig.resetTokenTtlMs),
    });

    await this.mail.send({
      to: user.email,
      subject: "Reset your OB-CMS password",
      html: `<p>Use this token to reset your password:</p><p><code>${raw}</code></p>`,
      text: `Reset token: ${raw}`,
    });
  }

  /**
   * Consume a reset token, set the new password, and invalidate all of the
   * user's outstanding reset tokens (single-use). Also revokes refresh tokens.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const tokenHash = sha256(token);
    const [row] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!row) throw new UnauthorizedException("Invalid or expired reset token");

    const passwordHash = await this.passwords.hash(password);
    await this.db.transaction(async (tx) => {
      await tx
        .update(systemUsers)
        .set({ passwordHash })
        .where(eq(systemUsers.id, row.userId));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.userId, row.userId));
      // A password change invalidates all sessions.
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
      await this.audit.record(
        {
          actorId: row.userId,
          action: "user.password_reset",
          category: "sessions",
          entityType: "system_user",
          entityId: row.userId,
        },
        tx as unknown as Database,
      );
    });
  }

  // -- helpers -------------------------------------------------------------

  private async buildSession(
    userId: string,
    email: string,
    isPlatformAdminFlag: boolean,
  ): Promise<IssuedSession> {
    const user = await this.toCurrentUser(userId, email, null, isPlatformAdminFlag);
    const payload: JwtPayload = { sub: userId, email, isPlatformAdmin: user.isPlatformAdmin };

    const refreshToken = this.tokens.generateRefreshToken();
    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash: this.tokens.hashRefresh(refreshToken),
      expiresAt: new Date(Date.now() + authConfig.refreshTokenTtlMs),
    });

    return { token: this.tokens.sign(payload), refreshToken, user };
  }

  private decryptTotpSecret(envelope: string | null | undefined): string | null {
    if (!envelope) return null;
    try {
      return decryptSecret(envelope, this.encKey);
    } catch {
      return null;
    }
  }

  private async toCurrentUser(
    userId: string,
    email: string,
    name: string | null | undefined,
    isPlatformAdminFlag: boolean,
  ): Promise<CurrentUser> {
    const [memberships, hasSuperRow] = await Promise.all([
      this.membership.listMemberships(userId),
      this.membership.isPlatformAdmin(userId),
    ]);
    return {
      id: userId,
      email,
      name: name ?? null,
      isPlatformAdmin: isPlatformAdminFlag || hasSuperRow,
      memberships,
    };
  }
}

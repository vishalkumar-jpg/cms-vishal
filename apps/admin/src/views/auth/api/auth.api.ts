import type { CurrentUser } from "@ob-cms/shared";
import { request } from "@/services/AxiosService";

/**
 * Raw auth API calls (until the Orval SDK is regenerated to cover these). Each
 * goes through the Axios mutator so the ResponseDto envelope is unwrapped.
 * Swapping to generated SDK functions later is a localized change here.
 */
export interface LoginPayload {
  email: string;
  password: string;
  /** Required only when the account has 2FA enabled. */
  totp?: string;
  /** A single-use backup recovery code (alternative to `totp`). */
  backupCode?: string;
}

/** /auth/me now also reports whether the user has 2FA enabled. */
export type CurrentUserWithTotp = CurrentUser & { totpEnabled?: boolean };

export const loginRequest = (payload: LoginPayload): Promise<CurrentUser> =>
  request<CurrentUser>({ url: "/auth/login", method: "POST", data: payload });

export const meRequest = (): Promise<CurrentUserWithTotp> =>
  request<CurrentUserWithTotp>({ url: "/auth/me", method: "GET" });

export const logoutRequest = (): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: "/auth/logout", method: "POST" });

// -- 2FA (TOTP) -------------------------------------------------------------

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  /** Server-rendered SVG QR (`data:image/svg+xml;base64,...`) for the otpauth URI. */
  qrDataUri: string;
}

/** Enable/regenerate return single-use backup codes shown exactly once. */
export interface BackupCodes {
  backupCodes: string[];
}

export const setup2faRequest = (): Promise<TwoFactorSetup> =>
  request<TwoFactorSetup>({ url: "/auth/2fa/setup", method: "POST" });

export const enable2faRequest = (code: string): Promise<BackupCodes> =>
  request<BackupCodes>({ url: "/auth/2fa/enable", method: "POST", data: { code } });

export const regenerateBackupCodesRequest = (args: {
  code?: string;
  password?: string;
}): Promise<BackupCodes> =>
  request<BackupCodes>({ url: "/auth/2fa/backup-codes", method: "POST", data: args });

export const disable2faRequest = (args: {
  code?: string;
  password?: string;
}): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: "/auth/2fa/disable", method: "POST", data: args });

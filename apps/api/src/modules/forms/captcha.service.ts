import { Injectable, Logger } from "@nestjs/common";
import { getOsEnvOptional } from "@config/env.config";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5000;

/**
 * Cloudflare Turnstile verification (FORMS-ADVANCED §captcha). The SECRET key is
 * read from env (`TURNSTILE_SECRET_KEY`); the public site key is surfaced to the
 * renderer via the public form schema (`TURNSTILE_SITE_KEY`).
 *
 * The contract is: captcha is OPTIONAL. It is only enforced for a form whose
 * `settings.spamProtection.captcha === true` AND when a secret key is configured.
 * When no secret key is present we fall back to the existing honeypot/timing
 * gates (so local dev + the e2e suite keep passing without Turnstile keys).
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  /** Present only when a Turnstile secret is configured (server-side enforce). */
  get enabled(): boolean {
    return Boolean(getOsEnvOptional("TURNSTILE_SECRET_KEY"));
  }

  /** Public site key for the renderer (safe to expose). */
  get siteKey(): string | undefined {
    return getOsEnvOptional("TURNSTILE_SITE_KEY");
  }

  /**
   * Verify a Turnstile token server-side. Returns true when the token is valid.
   * A network/timeout failure is treated as a FAILED verification (fail-closed)
   * since captcha is an explicit anti-abuse gate the author opted into.
   */
  async verify(token: string | undefined, ip?: string): Promise<boolean> {
    const secret = getOsEnvOptional("TURNSTILE_SECRET_KEY");
    if (!secret) return true; // not configured → caller falls back to honeypot
    if (!token || token.trim().length === 0) return false;

    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
    try {
      const res = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: controller.signal,
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { success?: boolean };
      return json.success === true;
    } catch (err) {
      this.logger.warn(`Turnstile verify failed: ${(err as Error).message}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}

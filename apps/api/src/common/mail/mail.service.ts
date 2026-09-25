import { Injectable, Logger } from "@nestjs/common";
import { loadMailConfig, type MailConfig, type MailProviderKind } from "./mail.config";
import type { MailProvider } from "./mail-provider.interface";
import { ConsoleMailProvider } from "./providers/console.provider";
import { ResendMailProvider } from "./providers/resend.provider";
import { SendgridMailProvider } from "./providers/sendgrid.provider";
import { SmtpMailProvider } from "./providers/smtp.provider";

/**
 * MailService — the single transactional-email entrypoint for the API
 * (invites, password reset, form notifications, workflow).
 *
 * Gap E25: behind the UNCHANGED public `send()` signature it now selects a
 * pluggable {@link MailProvider} from env at startup (MAIL_PROVIDER):
 *   smtp (default, MailHog locally / any SMTP in prod) | resend | sendgrid |
 *   console (logs only).
 *
 * Robustness: the provider is validated at boot; if a requested provider is
 * misconfigured (e.g. resend without RESEND_API_KEY) we log a warning and
 * degrade to the console provider so local dev + tests never break. Send
 * failures are retried once and then logged — never thrown — preserving the
 * original behaviour relied on by auth flows that "always return 200".
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly config: MailConfig;
  private readonly provider: MailProvider;

  constructor() {
    this.config = loadMailConfig();
    this.provider = this.selectProvider(this.config);
    this.logger.log(
      `Mail provider active: ${this.provider.name} (requested ${this.config.provider}), from ${this.config.from}`,
    );
  }

  /**
   * PUBLIC API — unchanged. All call sites (auth reset, invitations,
   * form-notify) pass { to, subject, html, text? } and ignore the result.
   */
  async send(opts: { to: string; subject: string; html: string; text?: string }): Promise<void> {
    const message = { ...opts, from: this.config.from };
    try {
      const result = await this.withRetry(() => this.provider.send(message));
      this.logger.debug?.(
        `Sent mail to ${opts.to} via ${this.provider.name}${result.id ? ` (id=${result.id})` : ""}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send mail to ${opts.to} via ${this.provider.name}: ${(err as Error).message}`,
      );
    }
  }

  /** Exposed for boot logging / diagnostics. */
  get activeProvider(): string {
    return this.provider.name;
  }

  /** Single retry with a short backoff before we give up and log. */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.logger.debug?.(`Mail send attempt 1 failed, retrying: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 200));
      return await fn();
    }
  }

  /**
   * Build the requested provider, degrading to console when its required
   * config is missing/invalid so the app never fails to boot.
   */
  private selectProvider(config: MailConfig): MailProvider {
    const fallback = (reason: string): MailProvider => {
      this.logger.warn(`Mail provider "${config.provider}" misconfigured (${reason}); using console.`);
      return new ConsoleMailProvider();
    };

    const kind: MailProviderKind = config.provider;
    switch (kind) {
      case "console":
        return new ConsoleMailProvider();
      case "resend":
        return config.resendApiKey
          ? new ResendMailProvider(config.resendApiKey)
          : fallback("RESEND_API_KEY not set");
      case "sendgrid":
        return config.sendgridApiKey
          ? new SendgridMailProvider(config.sendgridApiKey)
          : fallback("SENDGRID_API_KEY not set");
      case "smtp":
      default:
        if (!config.smtp.host) return fallback("SMTP_HOST not set");
        return new SmtpMailProvider(config.smtp);
    }
  }
}

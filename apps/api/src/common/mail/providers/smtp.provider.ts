import { Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import type { MailMessage, MailProvider, MailSendResult } from "../mail-provider.interface";

export interface SmtpProviderConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  /** Use implicit TLS (port 465). MailHog/dev = false. */
  secure: boolean;
}

/**
 * SmtpMailProvider — nodemailer over SMTP. The default provider: works for
 * MailHog locally (host localhost/mailhog, port 1025, no auth) AND any prod
 * SMTP relay (SES-SMTP, Mailgun-SMTP, Postmark-SMTP) via env. When user/pass
 * are present auth is enabled; otherwise it sends unauthenticated (MailHog).
 */
export class SmtpMailProvider implements MailProvider {
  readonly name = "smtp";
  private readonly logger = new Logger("MailProvider:smtp");
  private readonly transporter: Transporter;

  constructor(config: SmtpProviderConfig) {
    const hasAuth = Boolean(config.user && config.pass);
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      // MailHog speaks plain SMTP; only force-ignore TLS when not secure + no auth.
      ignoreTLS: !config.secure && !hasAuth,
      ...(hasAuth ? { auth: { user: config.user, pass: config.pass } } : {}),
    });
    this.logger.log(
      `SMTP transport host=${config.host} port=${config.port} secure=${config.secure} auth=${hasAuth}`,
    );
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    const info = await this.transporter.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { id: info.messageId };
  }
}

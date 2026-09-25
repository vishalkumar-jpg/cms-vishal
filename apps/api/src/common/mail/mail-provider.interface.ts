/**
 * MailProvider — the pluggable transactional-email abstraction (gap E25).
 *
 * `MailService` keeps its existing public `send()` signature; internally it
 * delegates to ONE of these providers, selected from env at startup:
 *   - SmtpMailProvider     (nodemailer; MailHog locally, any SMTP in prod)
 *   - ResendMailProvider   (Resend HTTP API, fetch-based)
 *   - SendgridMailProvider (SendGrid HTTP API, fetch-based)
 *   - ConsoleMailProvider  (logs only — never crashes dev/tests)
 *
 * Every provider takes a pre-resolved `from` (MailService fills the default),
 * so providers stay env-agnostic and easy to test.
 */
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Pre-resolved sender; MailService supplies the MAIL_FROM default. */
  from: string;
}

export interface MailSendResult {
  /** Provider message id when available (SMTP messageId, Resend/SendGrid id). */
  id?: string;
}

export interface MailProvider {
  /** Human-readable provider name for boot logging. */
  readonly name: string;
  send(message: MailMessage): Promise<MailSendResult>;
}

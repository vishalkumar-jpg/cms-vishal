import { Injectable, Logger } from "@nestjs/common";
import { MailService } from "@common/mail/mail.service";

interface NotifyField {
  label?: string;
  name: string;
}

/**
 * Per-form submission notification email (FORMS-ADVANCED §notify). When a form's
 * `settings.notifyEmails: string[]` is set, every successful (non-spam) public
 * submission triggers a notification email to each recipient with the submitted
 * field values. Sent inline on the submit path via the global MailService
 * (MailHog locally); failures are swallowed by MailService so a mail outage
 * never fails a lead capture or blocks CRM delivery.
 */
@Injectable()
export class FormNotifyService {
  private readonly logger = new Logger(FormNotifyService.name);

  constructor(private readonly mail: MailService) {}

  /** Best-effort fan-out of a notification email for one submission. */
  async notify(opts: {
    notifyEmails: unknown;
    formName: string;
    submissionId: string;
    fields: NotifyField[];
    data: Record<string, unknown>;
  }): Promise<void> {
    const recipients = this.recipients(opts.notifyEmails);
    if (recipients.length === 0) return;

    const subject = `New submission: ${opts.formName}`;
    const rows = opts.fields
      .map((f) => {
        const label = this.escapeHtml(f.label || f.name);
        const value = this.escapeHtml(this.stringify(opts.data[f.name]));
        return `<tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top">${label}</td><td style="padding:4px 0">${value}</td></tr>`;
      })
      .join("");
    const html =
      `<h2 style="font-family:sans-serif">New submission for “${this.escapeHtml(opts.formName)}”</h2>` +
      `<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">${rows}</table>` +
      `<p style="color:#888;font-family:sans-serif;font-size:12px">Submission ${this.escapeHtml(opts.submissionId)}</p>`;
    const text = opts.fields
      .map((f) => `${f.label || f.name}: ${this.stringify(opts.data[f.name])}`)
      .join("\n");

    await Promise.allSettled(
      recipients.map((to) => this.mail.send({ to, subject, html, text })),
    );
    this.logger.debug(`Queued submission notification to ${recipients.length} recipient(s)`);
  }

  private recipients(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => EMAIL.test(v))
      .slice(0, 20);
  }

  private stringify(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

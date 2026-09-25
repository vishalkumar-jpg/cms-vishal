import type { MailMessage, MailProvider, MailSendResult } from "../mail-provider.interface";

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

/**
 * Parse a "Name <addr@host>" or bare "addr@host" sender into SendGrid's
 * { email, name } shape.
 */
function parseFrom(from: string): { email: string; name?: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].replace(/^"|"$/g, "").trim();
    return name ? { email: match[2].trim(), name } : { email: match[2].trim() };
  }
  return { email: from.trim() };
}

/**
 * SendgridMailProvider — SendGrid v3 mail/send HTTP API. Fetch-based (no SDK /
 * no native dependency). Selected when MAIL_PROVIDER=sendgrid and
 * SENDGRID_API_KEY is set. SendGrid returns 202 with an empty body on success;
 * the message id is exposed via the `X-Message-Id` header.
 */
export class SendgridMailProvider implements MailProvider {
  readonly name = "sendgrid";

  constructor(private readonly apiKey: string) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const content = [{ type: "text/html", value: message.html }];
    if (message.text) content.unshift({ type: "text/plain", value: message.text });

    const res = await fetch(SENDGRID_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: parseFrom(message.from),
        subject: message.subject,
        content,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`SendGrid API ${res.status}: ${detail.slice(0, 300)}`);
    }

    return { id: res.headers.get("x-message-id") ?? undefined };
  }
}

import type { MailMessage, MailProvider, MailSendResult } from "../mail-provider.interface";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * ResendMailProvider — Resend transactional HTTP API. Fetch-based (no SDK / no
 * native dependency). Selected when MAIL_PROVIDER=resend and RESEND_API_KEY is
 * set. Throws on a non-2xx response; MailService catches and logs per the
 * existing non-throwing contract.
 */
export class ResendMailProvider implements MailProvider {
  readonly name = "resend";

  constructor(private readonly apiKey: string) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend API ${res.status}: ${detail.slice(0, 300)}`);
    }

    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { id: body.id };
  }
}

import { Logger } from "@nestjs/common";
import type { MailMessage, MailProvider, MailSendResult } from "../mail-provider.interface";

/**
 * ConsoleMailProvider — the always-safe fallback. Logs the message instead of
 * sending it, so dev/tests never crash when no real provider is configured (or
 * when a configured provider is misconfigured and we degrade to this).
 */
export class ConsoleMailProvider implements MailProvider {
  readonly name = "console";
  private readonly logger = new Logger("MailProvider:console");

  async send(message: MailMessage): Promise<MailSendResult> {
    this.logger.log(
      `[console mail] from=${message.from} to=${message.to} subject=${JSON.stringify(message.subject)}`,
    );
    return { id: `console-${Date.now()}` };
  }
}

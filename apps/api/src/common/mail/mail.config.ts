import { getOsEnv, getOsEnvOptional } from "@config/env.config";

export type MailProviderKind = "smtp" | "resend" | "sendgrid" | "console";

const DEFAULT_FROM = "OB-CMS <no-reply@officebeacon.com>";

export interface MailConfig {
  /** Requested provider (MAIL_PROVIDER), default "smtp". */
  provider: MailProviderKind;
  from: string;
  smtp: {
    host: string;
    port: number;
    user?: string;
    pass?: string;
    secure: boolean;
  };
  resendApiKey?: string;
  sendgridApiKey?: string;
}

function parseProvider(raw: string | undefined): MailProviderKind {
  const v = (raw ?? "smtp").trim().toLowerCase();
  if (v === "smtp" || v === "resend" || v === "sendgrid" || v === "console") return v;
  return "smtp";
}

/**
 * Read the mail configuration from env. MailHog-friendly defaults: SMTP host
 * localhost, port 1025, no auth, plain (non-secure). `MAIL_SMTP_SECURE=true`
 * forces implicit TLS for prod relays on port 465.
 */
export function loadMailConfig(): MailConfig {
  return {
    provider: parseProvider(getOsEnvOptional("MAIL_PROVIDER")),
    from: getOsEnvOptional("MAIL_FROM") ?? DEFAULT_FROM,
    smtp: {
      host: getOsEnv("SMTP_HOST") || "localhost",
      port: +(getOsEnvOptional("SMTP_PORT") ?? "1025"),
      user: getOsEnvOptional("SMTP_USER") || undefined,
      pass: getOsEnvOptional("SMTP_PASS") || undefined,
      secure: (getOsEnvOptional("MAIL_SMTP_SECURE") ?? "").toLowerCase() === "true",
    },
    resendApiKey: getOsEnvOptional("RESEND_API_KEY") || undefined,
    sendgridApiKey: getOsEnvOptional("SENDGRID_API_KEY") || undefined,
  };
}

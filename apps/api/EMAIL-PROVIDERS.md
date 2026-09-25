# Transactional Email Providers (gap E25)

OB-CMS sends transactional email (team invitations, password reset, form
notifications, workflow) through a single `MailService`. As of E25 the service
is provider-pluggable: it selects a backend from env at startup while keeping
its public API unchanged.

## Public API (unchanged)

```ts
class MailService {
  send(opts: { to: string; subject: string; html: string; text?: string }): Promise<void>;
}
```

`send()` never throws — failures are retried once then logged. Every caller
(`auth.service`, `invitations.service`, `forms/form-notify.service`) is
untouched.

## Architecture

```
caller.send({to,subject,html,text})
        │
        ▼
   MailService ── resolves MAIL_FROM default, selects provider at boot ──┐
        │                                                                │
        ▼                                                                │
   MailProvider (interface): send({to,subject,html,text,from}) → {id?}   │
        ├─ SmtpMailProvider     nodemailer (MailHog / any SMTP relay)    │
        ├─ ResendMailProvider   Resend HTTP API   (fetch, no SDK)        │
        ├─ SendgridMailProvider SendGrid HTTP API (fetch, no SDK)        │
        └─ ConsoleMailProvider  logs only (safe fallback)  ◄────degrade──┘
```

Files: `src/common/mail/mail.service.ts`, `mail.config.ts`,
`mail-provider.interface.ts`, `providers/{smtp,resend,sendgrid,console}.provider.ts`.

- The library is **nodemailer** (SMTP only); HTTP providers use the runtime
  `fetch` — no extra dependency, no native module.
- The active provider is logged at boot:
  `Mail provider active: smtp (requested smtp), from OB-CMS <no-reply@officebeacon.com>`.
- If a requested provider is misconfigured (e.g. `resend` without a key) the
  service logs a warning and **degrades to console**, so dev/tests never crash.

## Env matrix

| Var                | Default                              | Used by        | Notes                                            |
|--------------------|--------------------------------------|----------------|--------------------------------------------------|
| `MAIL_PROVIDER`    | `smtp`                               | all            | `smtp` \| `resend` \| `sendgrid` \| `console`    |
| `MAIL_FROM`        | `OB-CMS <no-reply@officebeacon.com>` | all            | default From header                              |
| `SMTP_HOST`        | `localhost`                          | smtp           | `mailhog` inside Docker compose                  |
| `SMTP_PORT`        | `1025`                               | smtp           | MailHog SMTP port                                |
| `SMTP_USER`        | —                                    | smtp           | enables auth when set with `SMTP_PASS`           |
| `SMTP_PASS`        | —                                    | smtp           | —                                                |
| `MAIL_SMTP_SECURE` | `false`                              | smtp           | `true` for implicit TLS (port 465)               |
| `RESEND_API_KEY`   | —                                    | resend         | required when `MAIL_PROVIDER=resend`             |
| `SENDGRID_API_KEY` | —                                    | sendgrid       | required when `MAIL_PROVIDER=sendgrid`           |

## Configure per environment

### Dev (default — MailHog)
No config needed. `MAIL_PROVIDER=smtp`, `SMTP_HOST=localhost`/`mailhog`,
`SMTP_PORT=1025`, no auth. Invites/reset/form-notify land in the MailHog UI.

### Prod via SMTP relay (SES-SMTP, Mailgun-SMTP, Postmark-SMTP)
```
MAIL_PROVIDER=smtp
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=465
MAIL_SMTP_SECURE=true
SMTP_USER=<relay-user>
SMTP_PASS=<relay-pass>
MAIL_FROM=OB-CMS <no-reply@yourdomain.com>
```

### Prod via Resend (HTTP API)
```
MAIL_PROVIDER=resend
RESEND_API_KEY=re_xxx
MAIL_FROM=OB-CMS <no-reply@yourdomain.com>
```

### Prod via SendGrid (HTTP API)
```
MAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxx
MAIL_FROM=OB-CMS <no-reply@yourdomain.com>
```

### Console (logging, no delivery)
```
MAIL_PROVIDER=console
```
Logs each message instead of sending — useful for CI / offline dev.

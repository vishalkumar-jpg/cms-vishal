# Forms — Advanced (gap D24)

Polish on top of the existing forms + forms→CRM pipeline. Everything below is
configured through the form's existing `settings` jsonb and per-field props — no
new DB columns or tables were added (view tracking lives in Redis).

## Settings / config shape

`form.settings` (jsonb):

```jsonc
{
  "submitLabel": "Send",
  "successMode": "message" | "redirect",   // thank-you behaviour
  "successMessage": "Thanks — we'll be in touch.",
  "redirectUrl": "https://example.com/thank-you",
  "notifyEmails": ["sales@acme.com", "alerts@acme.com"],
  "steps": ["Your details", "Project"],     // multi-step labels (index = step)
  "spamProtection": {
    "honeypot": true,
    "minSubmitSeconds": 2,
    "captcha": true                          // require Turnstile (if keys set)
  },
  "consent": { "required": true, "text": "I agree…" }
}
```

Each field (`form.fields[]`) may add:

```jsonc
{
  "type": "text | email | … | file",        // "file" = upload field
  "step": 0,                                  // 0-based step assignment
  "conditional": {                            // show/hide rule
    "field": "company",                       // another field's name
    "op": "equals|notEquals|contains|notEmpty|empty",
    "value": "Enterprise"
  }
}
```

## Features

1. **Conditional logic** — `field.conditional { field, op, value }`. Evaluated by
   the shared helper `conditional-logic.ts#isFieldVisible` on the server at submit
   time (a hidden field's value is dropped, so it can't be injected via a crafted
   POST) and is meant to be re-used by the public form runtime for show/hide. The
   admin builder has a per-field "Conditional logic" editor.
2. **Multi-step** — `settings.steps[]` defines step labels; each field's `step`
   index assigns it to a step. Admin "Steps" tab manages labels; the per-field
   "Step" select assigns fields. Single step = a normal form.
3. **File-upload field** — field `type: "file"`. The public form calls
   `POST /api/v1/public/forms/:id/upload` (host-resolved, content-type allow-listed,
   10 MB cap) which presigns a direct browser PUT to the same S3/MinIO bucket as
   media, and returns `{ uploadUrl, fileUrl, key }`. The browser uploads then
   submits `fileUrl` as the field value (stored verbatim in submission data; no
   media-library row is created).
4. **Captcha (Cloudflare Turnstile)** — enabled per-form via
   `settings.spamProtection.captcha = true`. Verified **server-side** on submit
   (`captcha.service.ts`) only when a secret key is configured; verification is
   fail-closed. When no secret is set, the gate is skipped and the existing
   honeypot + timing + rate-limit gates apply. The public form schema returns
   `{ captcha: { enabled, siteKey } }` for the renderer to mount the widget.
5. **Email notification on submit** — `settings.notifyEmails: string[]`. On a
   successful (non-spam) public submit, `form-notify.service.ts` sends each
   recipient an email (via the global `MailService` → MailHog locally) with the
   submitted field values. Sent inline + best-effort — it never blocks or
   disturbs the async CRM delivery.
6. **Thank-you / redirect** — `settings.successMode` + `successMessage` /
   `redirectUrl`. The submit response returns
   `{ successMode, successMessage, redirectUrl }` so the front-end shows the
   message or redirects.
7. **Submission analytics** — `GET /api/v1/forms/:id/analytics?days=30` returns
   `{ total, spam, delivered, windowDays, series[], views, conversionRate, recent[] }`.
   Counts come from `form_submissions`; `views`/`conversionRate` come from
   best-effort per-form Redis view counters incremented on public form render.
   The admin "Analytics" dialog shows totals, a daily bar chart, conversion, and a
   recent-submissions list with the submitted data.

## API surface (added)

- `GET  /api/v1/forms/:id/analytics?days=30`        (admin, contributor+)
- `POST /api/v1/public/forms/:id/upload`            (public, host-resolved presign)
- `GET  /api/v1/public/forms/:id` now also returns `captcha: { enabled, siteKey }`
- `POST /api/v1/public/forms/:id/submit` now accepts `captchaToken` and returns
  `successMode`.

## Environment variables (Turnstile)

| Var                    | Where  | Purpose                                                  |
| ---------------------- | ------ | -------------------------------------------------------- |
| `TURNSTILE_SECRET_KEY` | server | Turnstile secret used for server-side siteverify.        |
| `TURNSTILE_SITE_KEY`   | server | Public site key, surfaced to the renderer via form JSON. |

When `TURNSTILE_SECRET_KEY` is **absent**, captcha enforcement is disabled and the
honeypot/timing gates are the spam protection (keeps local dev + the e2e suite
green). File uploads reuse the existing media S3/MinIO env
(`S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
`S3_PUBLIC_URL`). Notification emails reuse `SMTP_HOST` / `SMTP_PORT` / `MAIL_FROM`.
```

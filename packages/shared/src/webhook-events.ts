/**
 * Outbound webhook event catalogue (E27). Subscriptions listen for these names;
 * emitters fan occurrences to matching active subscriptions.
 */
export const WEBHOOK_EVENT = {
  PAGE_PUBLISHED: "page.published",
  POST_PUBLISHED: "post.published",
  FORM_SUBMITTED: "form.submitted",
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENT)[keyof typeof WEBHOOK_EVENT];

/** All catalogue values — derived from {@link WEBHOOK_EVENT} so names cannot drift. */
export const WEBHOOK_EVENTS = Object.freeze(
  Object.values(WEBHOOK_EVENT),
) as readonly WebhookEvent[];

export function isWebhookEvent(value: string): value is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

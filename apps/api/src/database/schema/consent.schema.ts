import { boolean, index, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `consent_records` (prefix `cnr`) — PROOF-OF-CONSENT ledger (Privacy & Consent
 * suite / GDPR Art. 7(1) demonstrability). One append-only row per consent
 * decision the visitor makes in the renderer's banner/preference-center. Written
 * best-effort by the @Public host-resolved `POST /api/consent` beacon; the
 * client cookie `ob_consent` is the live source of truth for gating, this table
 * is the durable audit trail.
 *
 * Privacy-by-design: we store the visitor's random first-party `visitorId` (NOT
 * cross-site, may be absent pre-`ob_vid`) and only a SHA-256 hash of the IP
 * (never the raw IP) so a decision is attributable for a dispute without holding
 * PII. Tenant-private (siteId FK, cascade on site delete).
 */
export const consentRecords = obCmsSchema.table(
  "consent_records",
  {
    ...baseColumns("cnr"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** Decision time (server receipt). */
    ts: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** First-party random visitor id, when the visitor already had one. */
    visitorId: varchar({ length: 60 }),
    /** The categories the visitor accepted (necessary is always implied true). */
    analytics: boolean().notNull().default(false),
    marketing: boolean().notNull().default(false),
    /** The policy version in force when the decision was made. */
    policyVersion: varchar({ length: 40 }),
    /** How the choice was made: accept_all | reject | custom. */
    method: varchar({ length: 20 }).notNull().default("custom"),
    /** SHA-256 hash of the requester IP (NEVER the raw IP). */
    ipHash: varchar({ length: 64 }),
    /** Small extra context (userAgent snippet, path) — kept PII-free. */
    meta: jsonb().$type<Record<string, unknown>>(),
  },
  (t) => [
    index("cnr_site_ts_idx").on(t.siteId, t.ts),
    index("cnr_site_visitor_idx").on(t.siteId, t.visitorId),
  ],
);

export type ConsentRecordRow = typeof consentRecords.$inferSelect;
export type NewConsentRecordRow = typeof consentRecords.$inferInsert;

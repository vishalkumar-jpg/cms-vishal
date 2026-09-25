import { boolean, index, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `siteDomains` (prefix `dom`) — custom-domain binding + verification.
 *
 * - global unique(`domain`) prevents two sites claiming the same domain
 *   (anti-takeover).
 * - `verificationToken` is the random TXT value the owner must publish.
 * - W1 stores the data model + add/list; real DNS verify + TLS is a worker job
 *   in a later wave (verify endpoint flips status as a stub for now).
 */
export const siteDomains = obCmsSchema.table(
  "site_domains",
  {
    ...baseColumns("dom"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    domain: varchar({ length: 255 }).notNull().unique(),
    isPrimary: boolean().notNull().default(false),
    verified: boolean().notNull().default(false),
    status: varchar({ length: 20 }).notNull().default("pending"), // pending|verifying|verified|active|failed
    sslStatus: varchar({ length: 20 }).notNull().default("pending"), // pending|provisioning|active|failed
    // CUSTOM-DOMAINS — verification + TLS provisioning state machine.
    verificationToken: varchar({ length: 100 }).notNull(),
    verificationMethod: varchar({ length: 20 }).notNull().default("dns-txt"), // dns-txt
    tlsStatus: varchar({ length: 20 }).notNull().default("none"), // none|pending|issued|failed
    verifiedAt: timestamp({ withTimezone: true }),
    lastCheckedAt: timestamp({ withTimezone: true }),
    // SITE-HEALTH — SSL/cert-expiry monitoring. The ssl-check worker performs a
    // TLS handshake to <domain>:443 and stores the peer cert's `valid_to`.
    tlsExpiresAt: timestamp({ withTimezone: true }),
    tlsCheckedAt: timestamp({ withTimezone: true }),
    /** Last SSL-check outcome note (e.g. `ok`, `dns`, `timeout`, `no-cert`). */
    tlsCheckError: varchar({ length: 500 }),
  },
  (t) => [index("dom_site_idx").on(t.siteId)],
);

export type SiteDomainRow = typeof siteDomains.$inferSelect;
export type NewSiteDomainRow = typeof siteDomains.$inferInsert;

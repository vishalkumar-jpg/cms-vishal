import { index, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";
import { systemUsers } from "./system-users.schema";

/**
 * `siteInvitations` (prefix `inv`) — email-based team invitations.
 *
 * An invite lets a site_admin add a teammate by EMAIL (rather than by raw user
 * id). A unique random `token` backs the public accept link. On accept we attach
 * (or create + attach) the user as a `siteMembers` row with the invited role.
 *
 * - `email` is stored lowercased/normalized.
 * - `status` ∈ pending | accepted | revoked | expired.
 * - `expiresAt` defaults to +7 days (enforced in the service).
 * - A partial-uniqueness rule ("one ACTIVE pending invite per (site,email)") is
 *   enforced in the service layer, not the DB, since accepted/revoked rows stay.
 */
export const siteInvitations = obCmsSchema.table(
  "site_invitations",
  {
    ...baseColumns("inv"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    email: varchar({ length: 320 }).notNull(),
    role: varchar({ length: 20 }).notNull(), // site_admin | editor | contributor
    token: varchar({ length: 128 }).notNull().unique(),
    status: varchar({ length: 20 }).notNull().default("pending"), // pending|accepted|revoked|expired
    invitedBy: varchar({ length: 50 }).references(() => systemUsers.id, { onDelete: "set null" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    unique("inv_token_uq").on(t.token),
    index("inv_site_status_idx").on(t.siteId, t.status),
    index("inv_email_idx").on(t.email),
  ],
);

export type SiteInvitationRow = typeof siteInvitations.$inferSelect;
export type NewSiteInvitationRow = typeof siteInvitations.$inferInsert;

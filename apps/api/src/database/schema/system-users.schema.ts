import { boolean, index, text, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";

/**
 * `systemUsers` (prefix `usr`) — platform identity / login.
 *
 * Roles are NOT stored here — membership + role live per-site in `siteMembers`.
 * `isPlatformAdmin` is a denormalized convenience flag kept in sync with a
 * `super_admin` membership row (siteId = NULL); the guard treats either as
 * platform-admin. Emails are stored lowercased/normalized (see AuthService).
 */
export const systemUsers = obCmsSchema.table(
  "system_users",
  {
    ...baseColumns("usr"),
    email: varchar({ length: 320 }).notNull().unique(),
    passwordHash: text(),
    name: varchar({ length: 200 }),
    status: varchar({ length: 20 }).notNull().default("active"), // active | invited | disabled
    isPlatformAdmin: boolean().notNull().default(false),
    /**
     * 2FA (TOTP, RFC 6238). `totpSecret` holds the AES-256-GCM-encrypted Base32
     * shared secret (see @ob-cms/crypto). It is set during `2fa/setup` (pending)
     * and only honored once `totpEnabled` flips true via `2fa/enable`.
     */
    totpSecret: text(),
    totpEnabled: boolean().notNull().default(false),
  },
  (t) => [index("usr_email_idx").on(t.email)],
);

export type SystemUserRow = typeof systemUsers.$inferSelect;
export type NewSystemUserRow = typeof systemUsers.$inferInsert;

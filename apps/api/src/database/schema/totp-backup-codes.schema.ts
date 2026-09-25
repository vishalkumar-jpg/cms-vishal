import { index, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { systemUsers } from "./system-users.schema";

/**
 * `totpBackupCodes` (prefix `bkc`) — single-use 2FA recovery codes (C21 QR/backup).
 *
 * Each row is ONE recovery code. Only the SHA-256 hash of the raw code is
 * stored; the raw codes are shown to the user exactly ONCE at enable/regenerate
 * time and never persisted in the clear. At login, a presented backup code is
 * hashed and matched against the user's UNUSED rows; a match sets `usedAt`
 * (single-use) and allows login. "Regenerate" soft-deletes the whole prior set
 * and inserts a fresh batch. Disabling 2FA deletes every row for the user.
 */
export const totpBackupCodes = obCmsSchema.table(
  "totp_backup_codes",
  {
    ...baseColumns("bkc"),
    userId: varchar({ length: 50 })
      .notNull()
      .references(() => systemUsers.id, { onDelete: "cascade" }),
    codeHash: varchar({ length: 128 }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("bkc_user_idx").on(t.userId),
    index("bkc_code_hash_idx").on(t.codeHash),
  ],
);

export type TotpBackupCodeRow = typeof totpBackupCodes.$inferSelect;
export type NewTotpBackupCodeRow = typeof totpBackupCodes.$inferInsert;

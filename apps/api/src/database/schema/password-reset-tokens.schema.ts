import { index, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { systemUsers } from "./system-users.schema";

/**
 * `passwordResetTokens` (prefix `prt`) — single-use, time-boxed reset tokens.
 * Only the SHA-256 hash of the raw token is stored; the raw token is emailed.
 * `usedAt` marks consumption (single-use).
 */
export const passwordResetTokens = obCmsSchema.table(
  "password_reset_tokens",
  {
    ...baseColumns("prt"),
    userId: varchar({ length: 50 })
      .notNull()
      .references(() => systemUsers.id, { onDelete: "cascade" }),
    tokenHash: varchar({ length: 128 }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("prt_token_hash_idx").on(t.tokenHash), index("prt_user_idx").on(t.userId)],
);

export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetTokenRow = typeof passwordResetTokens.$inferInsert;

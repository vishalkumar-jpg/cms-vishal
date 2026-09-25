import { index, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { systemUsers } from "./system-users.schema";

/**
 * `refreshTokens` (prefix `rft`) — server-side refresh-token ledger (C21).
 *
 * Each row is ONE issued refresh token. Only the SHA-256 hash of the raw token
 * is stored; the raw token lives only in the httpOnly `ob_refresh` cookie. On
 * every `POST /auth/refresh` we look the row up by hash, validate it (not used,
 * not revoked, not expired), then ROTATE: mark the old row `usedAt` and insert a
 * fresh row. Logout sets `revokedAt`, so a stolen refresh cookie cannot mint new
 * access tokens afterward. `usedAt` set on a row that is presented again is a
 * reuse signal (token theft) — we revoke the whole chain for that user.
 */
export const refreshTokens = obCmsSchema.table(
  "refresh_tokens",
  {
    ...baseColumns("rft"),
    userId: varchar({ length: 50 })
      .notNull()
      .references(() => systemUsers.id, { onDelete: "cascade" }),
    tokenHash: varchar({ length: 128 }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("rft_token_hash_idx").on(t.tokenHash),
    index("rft_user_idx").on(t.userId),
  ],
);

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
export type NewRefreshTokenRow = typeof refreshTokens.$inferInsert;

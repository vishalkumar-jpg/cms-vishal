import { index, jsonb, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `api_keys` (prefix `apk`) — per-site keys for the PUBLIC read-only Content API
 * (gap E27). The plaintext key is shown ONCE on creation and NEVER stored; only
 * a SHA-256 hash + a short non-secret prefix (for display/lookup) are persisted.
 * A request authenticates by hashing its Bearer token and matching `keyHash`.
 * `scopes` is reserved for future granularity — today the only scope is `read`.
 */
export const apiKeys = obCmsSchema.table(
  "api_keys",
  {
    ...baseColumns("apk"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    /** Non-secret display prefix, e.g. `obk_live_a1b2c3` (the first chars). */
    keyPrefix: varchar({ length: 40 }).notNull(),
    /** SHA-256 hex of the full plaintext key. The plaintext is never stored. */
    keyHash: varchar({ length: 128 }).notNull(),
    scopes: jsonb().$type<string[]>().notNull().default(["read"]),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    // The hash is the global lookup key for the auth guard (constant-time match).
    unique("apk_key_hash_uq").on(t.keyHash),
    index("apk_site_idx").on(t.siteId),
  ],
);

export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type NewApiKeyRow = typeof apiKeys.$inferInsert;

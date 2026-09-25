import { timestamp, varchar } from "drizzle-orm/pg-core";
import { generateKSUIDWithPrefixSync } from "@utils/ksuid.utils";

/**
 * Shared columns for every table (prefixed KSUID id + audit + soft-delete).
 * Spread into each table: `{ ...baseColumns("sit"), ...fields }`.
 *
 * Column DB names are derived by drizzle's `casing: "snake_case"` (see db.ts /
 * drizzle.config.ts) — `createdAt` → `created_at`. Do not hand-name them.
 *
 * @param prefix 3-char lowercase entity prefix (e.g. `ten`, `sit`, `usr`).
 */
export const baseColumns = (prefix: string) => ({
  id: varchar({ length: 50 })
    .primaryKey()
    .$defaultFn(() => generateKSUIDWithPrefixSync(prefix)),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp({ withTimezone: true }),
  createdBy: varchar({ length: 50 }),
  updatedBy: varchar({ length: 50 }),
});

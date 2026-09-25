import { index, integer, unique, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `redirects` (prefix `rdr`) — per-site path redirects served by the renderer.
 * UNIQUE(siteId, fromPath). Loop detection is enforced in the service.
 */
export const redirects = obCmsSchema.table(
  "redirects",
  {
    ...baseColumns("rdr"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    fromPath: varchar({ length: 1000 }).notNull(),
    toPath: varchar({ length: 1000 }).notNull(),
    statusCode: integer().notNull().default(301), // 301 | 302 | 307 | 308
  },
  (t) => [
    unique("rdr_site_from_uq").on(t.siteId, t.fromPath),
    index("rdr_site_idx").on(t.siteId),
    // WAVE4b: explicit (site_id, from_path) lookup for the public hot path.
    index("rdr_site_from_idx").on(t.siteId, t.fromPath),
  ],
);

export type RedirectRow = typeof redirects.$inferSelect;
export type NewRedirectRow = typeof redirects.$inferInsert;

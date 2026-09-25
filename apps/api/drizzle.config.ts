import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

/**
 * Drizzle Kit config. Agents generate & commit migrations
 * (`bun run db:generate`); CI/user applies them (`bun run db:migrate`).
 * `casing: snake_case` must match db.ts.
 */
export default defineConfig({
  schema: "./src/database/schema/index.ts",
  out: "./src/database/migrations",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://obcms:obcms@localhost:5432/obcms",
  },
});

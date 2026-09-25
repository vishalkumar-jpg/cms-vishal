import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Importing env.config loads the repo-root .env via the WAVE4b walk-up loader.
import { getOsEnv } from "@config/env.config";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
const isSSLEnabled = process.env.DATABASE_SSL === "true";
const ssl = isSSLEnabled ? { ssl: { rejectUnauthorized: false } } : {};

/** Shared node-postgres pool (from DATABASE_URL, or individual DATABASE_* vars). */
export const pool = new Pool(
  databaseUrl
    ? { connectionString: databaseUrl, ...ssl }
    : {
        host: getOsEnv("DATABASE_HOST"),
        port: +getOsEnv("DATABASE_PORT"),
        user: getOsEnv("DATABASE_USER"),
        password: getOsEnv("DATABASE_PASSWORD"),
        database: getOsEnv("DATABASE_NAME"),
        ...ssl,
      },
);

/**
 * Drizzle instance — inject via the `DRIZZLE` token (see drizzle.providers.ts);
 * use `Database` as the injected type. `casing: snake_case` derives DB column
 * names from JS keys (works with baseColumns).
 */
export const db = drizzle(pool, {
  schema,
  casing: "snake_case",
  logger: getOsEnv("ENVIRONMENT") === "local",
});

export type Database = NodePgDatabase<typeof schema>;

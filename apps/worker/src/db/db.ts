import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
const isSSLEnabled = process.env.DATABASE_SSL === "true";
const ssl = isSSLEnabled ? { ssl: { rejectUnauthorized: false } } : {};

/** Worker's own node-postgres pool (same DB the API writes; read/update only). */
export const pool = new Pool(
  databaseUrl
    ? { connectionString: databaseUrl, ...ssl }
    : {
        host: process.env.DATABASE_HOST ?? "localhost",
        port: Number(process.env.DATABASE_PORT ?? "5433"),
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ...ssl,
      },
);

export const db = drizzle(pool, { schema, casing: "snake_case" });
export type Database = NodePgDatabase<typeof schema>;

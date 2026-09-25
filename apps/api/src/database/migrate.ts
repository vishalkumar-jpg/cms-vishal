import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db";
// Resolves the repo-root .env via the shared walk-up loader (WAVE4b).
import "@config/env.config";

/**
 * Apply pending drizzle migrations. Run via `bun run db:migrate`
 * (generate them first with `bun run db:generate`).
 */
async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("SCRIPT :: migrate :: running drizzle migrations...");
  await migrate(db, { migrationsFolder: "src/database/migrations" });
  // eslint-disable-next-line no-console
  console.log("SCRIPT :: migrate :: migrations applied");
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("SCRIPT :: migrate :: failed", error);
    await pool.end();
    process.exit(1);
  });

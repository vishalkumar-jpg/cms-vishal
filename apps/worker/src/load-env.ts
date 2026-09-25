import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "dotenv";

/**
 * Worker env loader (WAVE4b). Walk UP from cwd to the FIRST `.env` (repo root)
 * and load it, so a single root `.env` powers `bun run dev` for the worker too —
 * no per-app copy. Docker is preserved: compose injects env and dotenv never
 * overrides already-set values.
 */
export function loadEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      config({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  config();
}

// Load the env as a SIDE EFFECT on import. worker.ts imports this module
// (line 3) BEFORE the processor imports that pull in `db.ts`, whose Pool is
// built at import time from `process.env.DATABASE_URL`. Calling loadEnv() here
// guarantees the env is populated before any consumer reads it. dotenv never
// overrides already-set values, so an explicit loadEnv() call remains safe.
loadEnv();

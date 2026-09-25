import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config as dotenvConfig } from "dotenv";

/**
 * Monorepo env loader (WAVE4b — fixes the per-app `.env` copy TODO).
 *
 * Each app runs from its own directory (apps/api, apps/worker, apps/renderer),
 * so a bare `dotenv.config()` only ever finds an app-local `.env`. This walks UP
 * from the process cwd to the FIRST directory containing a `.env` (the repo
 * root) and loads it — so ONE root `/.env` powers `bun run dev` for every app,
 * no copies needed.
 *
 * Docker is preserved: compose injects real env vars and (typically) ships no
 * `.env` in the image, so `dotenv` finds nothing and the injected vars win
 * (dotenv never overrides already-set process.env values).
 *
 * Idempotent and safe to call from every app's bootstrap.
 */
export function loadEnv(): void {
  const found = findEnvFile(process.cwd());
  if (found) {
    dotenvConfig({ path: found });
  } else {
    // Fall back to default lookup (no-op if absent; compose env still applies).
    dotenvConfig();
  }
}

/** Walk up from `start` looking for a `.env` file; returns its path or null. */
function findEnvFile(start: string): string | null {
  let dir = start;
  // Bound the walk to avoid touching the filesystem root pathologically.
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

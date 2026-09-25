/**
 * Orval enables React Query hooks when an identifier is non-nullish, but empty
 * strings still pass. Treat empty identifiers as disabled for path-scoped hooks
 * on site members and template catalog reads.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SDK_DIR = join(import.meta.dirname, "../src/sdk");
const TARGET_FILES = ["site-members.ts", "template-catalog.ts"];

const ENABLED_PATTERN =
  /enabled: (\w+) !== null && \1 !== undefined/g;
const ENABLED_REPLACEMENT = "enabled: $1 != null && $1 !== ''";

for (const name of TARGET_FILES) {
  const path = join(SDK_DIR, name);
  const text = await readFile(path, "utf8");
  const patched = text.replace(ENABLED_PATTERN, ENABLED_REPLACEMENT);
  if (patched !== text) {
    await writeFile(path, patched);
  }
}

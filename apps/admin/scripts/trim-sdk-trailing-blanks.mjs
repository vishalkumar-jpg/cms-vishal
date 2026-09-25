/**
 * Orval occasionally emits multiple trailing blank lines in tag-split SDK files.
 * Normalize to a single trailing newline so `git diff --check` stays clean.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SDK_DIR = join(import.meta.dirname, "../src/sdk");

const files = await readdir(SDK_DIR);
for (const name of files) {
  if (!name.endsWith(".ts")) continue;
  const path = join(SDK_DIR, name);
  const text = await readFile(path, "utf8");
  const normalized = text.replace(/\n+\s*$/, "\n");
  if (normalized !== text) {
    await writeFile(path, normalized);
  }
}

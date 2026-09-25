/**
 * KSUID generator. @thi.ng/ksuid is ESM-only, so we lazy-load it and expose a
 * synchronous helper for drizzle column `$defaultFn` (which must be sync).
 * `initKsuid()` MUST be awaited at process startup (main.ts / worker.ts /
 * standalone scripts) before any insert relying on the id default.
 */
let ksuidGenerator: { next(): string } | null = null;

async function getGenerator(): Promise<{ next(): string }> {
  if (!ksuidGenerator) {
    const { defKSUID32 } = await import("@thi.ng/ksuid");
    ksuidGenerator = defKSUID32();
  }
  return ksuidGenerator;
}

export async function initKsuid(): Promise<void> {
  await getGenerator();
}

export function generateKSUIDSync(): string {
  if (!ksuidGenerator) {
    throw new Error("KSUID generator not initialized — call initKsuid() at startup");
  }
  return ksuidGenerator.next();
}

export function generateKSUIDWithPrefixSync(prefix: string): string {
  return `${prefix}_${generateKSUIDSync()}`;
}

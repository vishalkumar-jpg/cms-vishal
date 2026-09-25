/**
 * Worker-local KSUID helper (mirrors apps/api/src/utils/ksuid.utils.ts).
 * @thi.ng/ksuid is ESM-only; lazy-load + expose a sync helper. `initKsuid()`
 * MUST be awaited at worker startup before any insert that supplies an id.
 */
let generator: { next(): string } | null = null;

export async function initKsuid(): Promise<void> {
  if (!generator) {
    const { defKSUID32 } = await import("@thi.ng/ksuid");
    generator = defKSUID32();
  }
}

export function generateKSUIDWithPrefixSync(prefix: string): string {
  if (!generator) {
    throw new Error("KSUID generator not initialized — call initKsuid() at startup");
  }
  return `${prefix}_${generator.next()}`;
}

import type { Provider } from "@nestjs/common";
import { db } from "./db";

/**
 * Injection token for the drizzle database instance.
 * Inject with: `constructor(@Inject(DRIZZLE) private readonly db: Database) {}`
 */
export const DRIZZLE = Symbol("DRIZZLE");

export const drizzleProvider: Provider = {
  provide: DRIZZLE,
  useValue: db,
};

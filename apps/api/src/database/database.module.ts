import { Global, Module } from "@nestjs/common";
import { drizzleProvider } from "./drizzle.providers";

/** Provides the drizzle instance (via the `DRIZZLE` token) to the whole app. */
@Global()
@Module({
  providers: [drizzleProvider],
  exports: [drizzleProvider],
})
export class DatabaseModule {}

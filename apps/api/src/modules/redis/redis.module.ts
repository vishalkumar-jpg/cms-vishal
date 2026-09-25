import { Global, Module } from "@nestjs/common";
import { Redis } from "ioredis";
import { getOsEnv, getOsEnvOptional } from "@config/env.config";
import { REDIS_CLIENT } from "./redis.constants";
import { RedisService } from "./redis.service";

export { REDIS_CLIENT } from "./redis.constants";

/**
 * RedisModule — shared ioredis client (cache + domain→site map + token bucket).
 * Marked @Global so a single import wires it for the whole process.
 * TODO(W3): tenant domain-map cache; TODO(W4b): rate-limit token buckets.
 */

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis =>
        new Redis({
          host: getOsEnv("REDIS_HOST") || "localhost",
          port: +(getOsEnvOptional("REDIS_PORT") ?? "6379"),
          password: getOsEnvOptional("REDIS_PASSWORD") || undefined,
          maxRetriesPerRequest: null,
          lazyConnect: true,
        }),
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}

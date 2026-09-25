import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { BULL_PREFIX } from "@ob-cms/shared";
import { getOsEnv, getOsEnvOptional } from "@config/env.config";
import { QUEUE_NAMES } from "./queue.constants";
import { QueueService } from "./queue.service";

/**
 * QueueModule — shared BullMQ root. Registers the Redis connection + default
 * job options ONCE, then re-exports BullModule so feature modules (in either
 * the API or the worker process) declare queues with
 * `BullModule.registerQueue({ name })`. The worker process consumes; the API
 * produces. Both share one Redis. @Global so one import wires the process.
 */
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: getOsEnv("REDIS_HOST") || "localhost",
        port: +(getOsEnvOptional("REDIS_PORT") ?? "6379"),
        password: getOsEnvOptional("REDIS_PASSWORD") || undefined,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
      prefix: BULL_PREFIX,
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.SAMPLE }),
    BullModule.registerQueue({ name: QUEUE_NAMES.MEDIA_PROCESS }),
    BullModule.registerQueue({ name: QUEUE_NAMES.SITEMAP_REBUILD }),
    BullModule.registerQueue({ name: QUEUE_NAMES.CACHE_PURGE }),
    // WAVE3b — forms→CRM reliability pipeline (+ durable DLQ mirror).
    BullModule.registerQueue({ name: QUEUE_NAMES.CRM_DELIVERY }),
    BullModule.registerQueue({ name: QUEUE_NAMES.CRM_DELIVERY_DLQ }),
    // WAVE4a — AI copilot page generation.
    BullModule.registerQueue({ name: QUEUE_NAMES.AI_GENERATE }),
    // E27 — outbound webhook delivery (+ durable DLQ mirror).
    BullModule.registerQueue({ name: QUEUE_NAMES.WEBHOOK_DELIVERY }),
    BullModule.registerQueue({ name: QUEUE_NAMES.WEBHOOK_DELIVERY_DLQ }),
    // E26 — platform-level database backup / restore.
    BullModule.registerQueue({ name: QUEUE_NAMES.BACKUP }),
    // #30 — page-audit / certification (real Lighthouse in the worker).
    BullModule.registerQueue({ name: QUEUE_NAMES.PAGE_AUDIT }),
    // PHASE-3 — identity profile rebuild + audience membership recompute.
    BullModule.registerQueue({ name: QUEUE_NAMES.PROFILE_REBUILD }),
    BullModule.registerQueue({ name: QUEUE_NAMES.AUDIENCE_RECOMPUTE }),
    // PHASE-5 — workflow run executor.
    BullModule.registerQueue({ name: QUEUE_NAMES.WORKFLOW_RUN }),
    // SITE-HEALTH — broken-link crawl + SSL/cert-expiry check.
    BullModule.registerQueue({ name: QUEUE_NAMES.LINK_CHECK }),
    BullModule.registerQueue({ name: QUEUE_NAMES.SSL_CHECK }),
  ],
  providers: [QueueService],
  exports: [BullModule, QueueService],
})
export class QueueModule {}

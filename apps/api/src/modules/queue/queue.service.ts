import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import {
  AI_JOBS,
  AUDIENCE_JOBS,
  BACKUP_JOBS,
  CACHE_JOBS,
  CRM_JOBS,
  LINK_CHECK_JOBS,
  MEDIA_JOBS,
  PAGE_AUDIT_JOBS,
  PROFILE_JOBS,
  QUEUE_NAMES,
  SAMPLE_JOBS,
  SITEMAP_JOBS,
  SSL_CHECK_JOBS,
  WEBHOOK_JOBS,
  WORKFLOW_JOBS,
  type AiGenerateJob,
  type AudienceRecomputeJob,
  type BackupRestoreJob,
  type BackupRunJob,
  type CachePurgeJob,
  type CrmDeliveryJob,
  type LinkCheckJob,
  type MediaProcessJob,
  type PageAuditJob,
  type ProfileRebuildJob,
  type SitemapRebuildJob,
  type SslCheckJob,
  type WebhookDeliveryJob,
  type WorkflowRunJob,
} from "./queue.constants";

/** Producers for the background queues. The worker process consumes them. */
@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.SAMPLE) private readonly sampleQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MEDIA_PROCESS) private readonly mediaQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SITEMAP_REBUILD) private readonly sitemapQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CACHE_PURGE) private readonly cacheQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CRM_DELIVERY) private readonly crmQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AI_GENERATE) private readonly aiQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WEBHOOK_DELIVERY) private readonly webhookQueue: Queue,
    @InjectQueue(QUEUE_NAMES.BACKUP) private readonly backupQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PAGE_AUDIT) private readonly pageAuditQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PROFILE_REBUILD) private readonly profileQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AUDIENCE_RECOMPUTE) private readonly audienceQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_RUN) private readonly workflowQueue: Queue,
    @InjectQueue(QUEUE_NAMES.LINK_CHECK) private readonly linkCheckQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SSL_CHECK) private readonly sslCheckQueue: Queue,
  ) {}

  async enqueuePing(payload: { message: string }): Promise<string | undefined> {
    const job = await this.sampleQueue.add(SAMPLE_JOBS.PING, payload);
    return job.id;
  }

  /** Image variant/dimension extraction for a confirmed upload. */
  async enqueueMediaProcess(payload: MediaProcessJob): Promise<string | undefined> {
    const job = await this.mediaQueue.add(MEDIA_JOBS.PROCESS, payload);
    return job.id;
  }

  /** Server-side crop → re-derive variants. Coalesced per media id. */
  async enqueueMediaCrop(payload: MediaProcessJob): Promise<string | undefined> {
    const job = await this.mediaQueue.add(MEDIA_JOBS.CROP, payload, {
      jobId: `media-crop:${payload.mediaId}`,
    });
    return job.id;
  }

  /**
   * Debounced sitemap rebuild — `jobId` keyed by site so rapid publishes
   * coalesce, with a short delay window before the worker regenerates+purges.
   */
  async enqueueSitemapRebuild(payload: SitemapRebuildJob): Promise<string | undefined> {
    const job = await this.sitemapQueue.add(SITEMAP_JOBS.REBUILD, payload, {
      jobId: `sitemap:${payload.siteId}`,
      delay: 5000,
    });
    return job.id;
  }

  /** Renderer cache purge after a publish/unpublish. */
  async enqueueCachePurge(payload: CachePurgeJob): Promise<string | undefined> {
    const job = await this.cacheQueue.add(CACHE_JOBS.PURGE, payload);
    return job.id;
  }

  /**
   * Forms→CRM delivery (WAVE3b). `jobId` is keyed on the submission so a stray
   * double-enqueue coalesces; exponential backoff retries transient CRM
   * outages and exhaustion routes to the DLQ (worker). The submission row in
   * Postgres is the durable source of truth — losing this job never loses a lead
   * (the sweeper re-enqueues stuck `stored`/`failed` rows).
   */
  async enqueueCrmDelivery(payload: CrmDeliveryJob): Promise<string | undefined> {
    const job = await this.crmQueue.add(CRM_JOBS.DELIVER, payload, {
      jobId: `crm:${payload.submissionId}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
    });
    return job.id;
  }

  /**
   * AI page generation (WAVE4a). `jobId` keyed on the generation-job row id so a
   * stray double-enqueue coalesces. Only 1 attempt by default — generation is
   * expensive and the worker runs its own internal self-correction retry; a
   * BullMQ retry would re-bill the tenant's LLM key, so we don't auto-retry.
   */
  async enqueueAiGenerate(payload: AiGenerateJob): Promise<string | undefined> {
    const job = await this.aiQueue.add(AI_JOBS.GENERATE, payload, {
      jobId: `ai:${payload.jobId}`,
      attempts: 1,
    });
    return job.id;
  }

  /**
   * Outbound webhook delivery (E27). `jobId` keyed on the delivery-row id so a
   * stray double-enqueue coalesces; exponential backoff retries transient
   * subscriber outages and exhaustion routes to the DLQ (worker). The
   * `webhook_deliveries` row in Postgres is the durable source of truth.
   */
  async enqueueWebhookDelivery(payload: WebhookDeliveryJob): Promise<string | undefined> {
    const job = await this.webhookQueue.add(WEBHOOK_JOBS.DELIVER, payload, {
      jobId: `webhook:${payload.deliveryId}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
    });
    return job.id;
  }

  /**
   * Platform DB backup RUN (E26). `jobId` keyed on the backups row so a stray
   * double-enqueue coalesces. Single attempt — a half-finished dump shouldn't be
   * silently retried; the row is marked `failed` and the admin re-triggers.
   */
  async enqueueBackupRun(payload: BackupRunJob): Promise<string | undefined> {
    const job = await this.backupQueue.add(BACKUP_JOBS.RUN, payload, {
      jobId: `backup-run:${payload.backupId}`,
      attempts: 1,
    });
    return job.id;
  }

  /**
   * Platform DB RESTORE (E26). Destructive — only called after an explicit
   * confirm flag in the controller. Single attempt, no auto-retry.
   */
  async enqueueBackupRestore(payload: BackupRestoreJob): Promise<string | undefined> {
    const job = await this.backupQueue.add(BACKUP_JOBS.RESTORE, payload, {
      jobId: `backup-restore:${payload.backupId}`,
      attempts: 1,
    });
    return job.id;
  }

  /**
   * Page-audit RUN (#30). `jobId` keyed on the `page_audits` row so a stray
   * double-enqueue coalesces. BullMQ retries transient Lighthouse/Chrome throws
   * (the processor re-throws while attempts remain); terminal skip/fail is
   * written on the final attempt only.
   */
  async enqueuePageAudit(payload: PageAuditJob): Promise<string | undefined> {
    const opts = {
      jobId: `page-audit:${payload.auditId}`,
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    };
    // Retry the *enqueue* itself on transient Redis hiccups (distinct from job attempts).
    let lastErr: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        const job = await this.pageAuditQueue.add(PAGE_AUDIT_JOBS.RUN, payload, opts);
        return job.id;
      } catch (err) {
        lastErr = err;
        if (i < 2) await new Promise((r) => setTimeout(r, 250 * 2 ** i));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  /**
   * Profile rebuild (Phase 3). `jobId` keyed on the site so rapid rebuild
   * requests coalesce into one recompute. The job aggregates events into
   * visitor_profiles + applies scoring rules; it is idempotent.
   */
  async enqueueProfileRebuild(payload: ProfileRebuildJob): Promise<string | undefined> {
    const job = await this.profileQueue.add(PROFILE_JOBS.REBUILD, payload, {
      jobId: `profile-rebuild:${payload.siteId}`,
    });
    return job.id;
  }

  /**
   * Audience recompute (Phase 3). `jobId` keyed on the audience (or the site for
   * an all-audiences recompute) so double-enqueues coalesce. The job rewrites
   * audience_memberships idempotently.
   */
  async enqueueAudienceRecompute(payload: AudienceRecomputeJob): Promise<string | undefined> {
    const job = await this.audienceQueue.add(AUDIENCE_JOBS.RECOMPUTE, payload, {
      jobId: `audience-recompute:${payload.audienceId ?? payload.siteId}`,
    });
    return job.id;
  }

  /**
   * Workflow run execution (Phase 5). `jobId` keyed on the run so a stray
   * double-enqueue coalesces. The worker advances the run step-by-step and
   * re-enqueues itself (with a delay) for a `wait` action. Idempotent per run.
   */
  async enqueueWorkflowRun(payload: WorkflowRunJob, delayMs = 0): Promise<string | undefined> {
    const job = await this.workflowQueue.add(WORKFLOW_JOBS.EXECUTE, payload, {
      jobId: delayMs > 0 ? `workflow-run:${payload.runId}:${Date.now()}` : `workflow-run:${payload.runId}`,
      delay: delayMs > 0 ? delayMs : undefined,
    });
    return job.id;
  }

  /**
   * Broken-link crawl RUN (SITE-HEALTH). `jobId` keyed on the `link_checks` row
   * so a stray double-enqueue coalesces. Single attempt — the crawl is
   * best-effort and self-guards every network call; a partial run marks the row
   * `completed`/`failed` rather than looping BullMQ retries.
   */
  async enqueueLinkCheck(payload: LinkCheckJob): Promise<string | undefined> {
    const job = await this.linkCheckQueue.add(LINK_CHECK_JOBS.RUN, payload, {
      jobId: `link-check:${payload.runId}`,
      attempts: 1,
    });
    return job.id;
  }

  /**
   * SSL/cert-expiry check (SITE-HEALTH). On-demand single-domain re-check (pass
   * `domainId`) or a per-site sweep (pass `siteId`). `jobId` coalesces stray
   * double-enqueues. Single attempt — the TLS probe self-guards and records the
   * outcome onto the domain row.
   */
  async enqueueSslCheck(payload: SslCheckJob): Promise<string | undefined> {
    const key = payload.domainId ?? payload.siteId ?? "all";
    const job = await this.sslCheckQueue.add(SSL_CHECK_JOBS.RUN, payload, {
      jobId: `ssl-check:${key}`,
      attempts: 1,
    });
    return job.id;
  }
}

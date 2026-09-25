import { index, integer, jsonb, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * WAVE4a — AI copilot (BYOK page generation).
 *
 * `ai_provider_keys` (prefix `apk`) — a tenant's own LLM credential, encrypted
 * at rest (AES-256-GCM envelope in `encryptedKey`; only a masked `keyHint` is
 * ever returned). Scoped to a site (`siteId`), unique per (site, provider). The
 * plaintext key is decrypted only inside the worker's provider call.
 *
 * `ai_generation_jobs` (prefix `agj`) — one row per generate/refine request.
 * The API enqueues a BullMQ `ai-generate` job and inserts this row as
 * `queued`; the worker drives it through running → succeeded/failed, writing the
 * validated SerializedLayout into `resultLayout` and token/cost telemetry.
 */

export const PROVIDERS = ["claude", "openai", "gemini"] as const;
export type AiProvider = (typeof PROVIDERS)[number];

export const AI_JOB_STATUSES = ["queued", "running", "succeeded", "failed"] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export const aiProviderKeys = obCmsSchema.table(
  "ai_provider_keys",
  {
    ...baseColumns("apk"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    provider: varchar({ length: 20 }).notNull(),
    label: varchar({ length: 120 }),
    // AES-256-GCM envelope `v1:iv:tag:ct` — never returned over the wire.
    encryptedKey: varchar({ length: 2000 }).notNull(),
    // Masked, non-reversible hint for display (e.g. `sk-a…X9f2`).
    keyHint: varchar({ length: 40 }).notNull(),
    lastUsedAt: timestamp({ withTimezone: true }),
  },
  (t) => [unique("apk_site_provider_uq").on(t.siteId, t.provider)],
);

export const aiGenerationJobs = obCmsSchema.table(
  "ai_generation_jobs",
  {
    ...baseColumns("agj"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    prompt: varchar({ length: 8000 }).notNull(),
    provider: varchar({ length: 20 }).notNull(),
    model: varchar({ length: 80 }).notNull(),
    status: varchar({ length: 20 }).notNull().default("queued"),
    // Set on refine, or filled after a successful generate creates a draft page.
    targetPageId: varchar({ length: 50 }),
    resultLayout: jsonb(),
    tokensIn: integer().notNull().default(0),
    tokensOut: integer().notNull().default(0),
    // Stored in micro-USD (integer) to avoid float drift.
    costEstimateMicroUsd: integer().notNull().default(0),
    error: varchar({ length: 2000 }),
  },
  (t) => [index("agj_site_status_idx").on(t.siteId, t.status)],
);

export type AiProviderKeyRow = typeof aiProviderKeys.$inferSelect;
export type NewAiProviderKeyRow = typeof aiProviderKeys.$inferInsert;
export type AiGenerationJobRow = typeof aiGenerationJobs.$inferSelect;
export type NewAiGenerationJobRow = typeof aiGenerationJobs.$inferInsert;

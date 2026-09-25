import { isHomepageSlug } from "@ob-cms/block-schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { Job, Queue } from "bullmq";
import { db } from "../db/db";
import { generateKSUIDWithPrefixSync } from "../db/ksuid";
import { PAGE_AUDIT_JOBS } from "../queue-names";
import { pageAudits, pages, siteSettings, sites, type PageAuditConfig } from "../db/schema";

/**
 * PAGESPEED (Phase 5) — scheduled "scan all pages" sweep.
 *
 * Runs on an HOURLY repeatable cron. It does NOT run Lighthouse itself: it is a
 * thin scheduler that, for every site whose `site_settings.page_audit_config`
 * enables a schedule that is DUE this hour, fans out one `page-audit` job per
 * published page onto the EXISTING PAGE_AUDIT queue — the exact same pipeline the
 * on-demand "Scan all pages" button uses. No new processing pipeline, no new
 * tables (only the schedule config on site_settings).
 *
 * GUARDED: a per-site failure never aborts the sweep; the worker never crashes.
 * DEDUPED: `lastScheduledScanAt` is stamped after a scan is queued (skip if a
 * scan already ran in the last ~23h), and a site with audits still in flight
 * (pending/running) is skipped so schedules cannot pile up.
 */

const BULK_AUDIT_MAX_PAGES = Number(process.env.PAGE_AUDIT_MAX_PAGES ?? "50");
const DEFAULT_HOUR = 3;
const DEFAULT_DAY_OF_WEEK = 1; // Monday
/** Don't re-enqueue if a scheduled scan already fired within this window. */
const MIN_RESCAN_GAP_MS = 23 * 60 * 60 * 1000;
/** Retry options mirror the API's enqueuePageAudit (transient-error resilience). */
const AUDIT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: 100,
  removeOnFail: 100,
};

/** Map a page slug to its public path (homepage slugs → `/`). */
function slugToPath(slug: string): string {
  if (slug === "index" || isHomepageSlug(slug)) return "/";
  return `/${slug.replace(/^\/+/, "")}`;
}

/** Local/dev audit origin — mirrors MonitoringService.auditBaseFromEnv. */
function auditBaseFromEnv(): string {
  return (
    process.env.AUDIT_BASE_URL ||
    process.env.RENDERER_BASE_URL ||
    process.env.RENDERER_INTERNAL_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Resolve audit URL + tenant Host (mirrors monitoring.service.resolveAuditTarget). */
function resolveAuditTarget(
  site: { subdomain: string; primaryDomain: string | null; customDomain: string | null },
  path: string,
): { url: string; hostHeader: string } {
  const normPath = path.startsWith("/") ? path : `/${path}`;
  const domain = site.primaryDomain || site.customDomain;
  if (domain) return { url: `https://${domain}${normPath}`, hostHeader: domain };

  const baseDomain = process.env.PLATFORM_BASE_DOMAIN;
  if (baseDomain) {
    const host = `${site.subdomain}.${baseDomain}`;
    return { url: `https://${host}${normPath}`, hostHeader: host };
  }

  const renderer = auditBaseFromEnv();
  const host = `${site.subdomain}.localhost`;
  let baseUrl = renderer;
  try {
    const u = new URL(renderer);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      u.hostname = host;
      baseUrl = u.origin;
    }
  } catch {
    /* keep renderer */
  }
  return { url: `${baseUrl}${normPath}`, hostHeader: host };
}

/** Is a schedule due to run in the current UTC hour? */
function isDue(schedule: NonNullable<PageAuditConfig["schedule"]>, now: Date): boolean {
  if (!schedule.enabled) return false;

  const hour = schedule.hour ?? DEFAULT_HOUR;
  if (now.getUTCHours() !== hour) return false;

  if (schedule.frequency === "weekly") {
    const dow = schedule.dayOfWeek ?? DEFAULT_DAY_OF_WEEK;
    if (now.getUTCDay() !== dow) return false;
  }

  if (schedule.lastScheduledScanAt) {
    const last = Date.parse(schedule.lastScheduledScanAt);
    if (!Number.isNaN(last) && now.getTime() - last < MIN_RESCAN_GAP_MS) return false;
  }
  return true;
}

/** Enqueue one page-audit per published page for a site. Returns queued count. */
async function scanSite(pageAuditQueue: Queue, siteId: string): Promise<number> {
  const [site] = await db
    .select({
      subdomain: sites.subdomain,
      primaryDomain: sites.primaryDomain,
      customDomain: sites.customDomain,
    })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  if (!site) return 0;

  // DEDUPE: never stack a scheduled scan on top of an in-flight one (recent rows only).
  const staleBefore = new Date(
    Date.now() -
      (Number(process.env.PAGE_AUDIT_STALE_MS ?? "0") ||
        Number(process.env.PAGE_AUDIT_TIMEOUT_MS ?? "60000") * 3 + 120_000),
  );
  const inFlight = await db
    .select({ id: pageAudits.id })
    .from(pageAudits)
    .where(
      and(
        eq(pageAudits.siteId, siteId),
        inArray(pageAudits.status, ["pending", "running"]),
        gte(pageAudits.ranAt, staleBefore),
      ),
    )
    .limit(1);
  if (inFlight.length > 0) {
    console.log(`[worker:page-audit-schedule] ${siteId}: scan already in flight, skipping`);
    return 0;
  }

  const published = await db
    .select({ id: pages.id, slug: pages.slug })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.status, "published")))
    .limit(BULK_AUDIT_MAX_PAGES);

  const byPath = new Map<string, { pageId: string | null; path: string }>();
  for (const p of published) {
    const path = slugToPath(p.slug);
    if (!byPath.has(path)) byPath.set(path, { pageId: p.id, path });
  }
  if (!byPath.has("/")) byPath.set("/", { pageId: null, path: "/" });
  const targets = [...byPath.values()];

  const batchId = generateKSUIDWithPrefixSync("aub");
  let queued = 0;
  for (const t of targets) {
    const { url, hostHeader } = resolveAuditTarget(site, t.path);
    const [row] = await db
      .insert(pageAudits)
      .values({
        id: generateKSUIDWithPrefixSync("pau"),
        siteId,
        pageId: t.pageId,
        path: t.path,
        status: "pending",
        batchId,
        ranAt: new Date(),
      })
      .returning({ id: pageAudits.id });
    try {
      await pageAuditQueue.add(
        PAGE_AUDIT_JOBS.RUN,
        { auditId: row.id, siteId, path: t.path, url, hostHeader },
        { ...AUDIT_JOB_OPTS, jobId: `page-audit:${row.id}` },
      );
      queued++;
    } catch (err) {
      const message = `queue error: ${((err as Error).message || String(err)).slice(0, 450)}`;
      await db
        .update(pageAudits)
        .set({ status: "failed", detail: message, ranAt: new Date() })
        .where(eq(pageAudits.id, row.id));
      console.warn(`[worker:page-audit-schedule] enqueue failed ${row.id}: ${message}`);
    }
  }
  console.log(`[worker:page-audit-schedule] ${siteId}: queued ${queued} page(s) (batch ${batchId})`);
  return queued;
}

export async function processPageAuditSchedule(
  _job: Job,
  pageAuditQueue: Queue,
): Promise<{ ok: boolean; scannedSites: number; queued: number }> {
  const now = new Date();

  const rows = await db
    .select({ siteId: siteSettings.siteId, config: siteSettings.pageAuditConfig })
    .from(siteSettings);

  let scannedSites = 0;
  let queued = 0;
  for (const r of rows) {
    const schedule = r.config?.schedule;
    if (!schedule || !isDue(schedule, now)) continue;
    try {
      const n = await scanSite(pageAuditQueue, r.siteId);
      if (n > 0) {
        scannedSites++;
        queued += n;
        // Stamp lastScheduledScanAt only when pages were actually queued.
        const iso = now.toISOString();
        await db
          .update(siteSettings)
          .set({
            pageAuditConfig: sql`jsonb_set(
            jsonb_set(
              coalesce(${siteSettings.pageAuditConfig}, '{}'::jsonb),
              '{schedule}',
              coalesce(${siteSettings.pageAuditConfig}->'schedule', '{}'::jsonb),
              true
            ),
            '{schedule,lastScheduledScanAt}',
            to_jsonb(${iso}::text),
            true
          )`,
          })
          .where(eq(siteSettings.siteId, r.siteId));
      }
    } catch (err) {
      console.warn(
        `[worker:page-audit-schedule] ${r.siteId} failed`,
        (err as Error).message,
      );
    }
  }
  return { ok: true, scannedSites, queued };
}

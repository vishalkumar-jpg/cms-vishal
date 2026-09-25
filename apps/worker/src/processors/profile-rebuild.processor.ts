import type { Job, Queue } from "bullmq";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/db";
import {
  analyticsEvents,
  companies,
  identities,
  scoringRules,
  visitorProfiles,
  workflows,
} from "../db/schema";
import { generateKSUIDWithPrefixSync } from "../db/ksuid";
import { evalCondition, type Condition, type ProfileView } from "../db/rules";
import { enqueueWorkflowRuns } from "../db/workflow-triggers";

/** A profile whose score crossed UP through a threshold this run. */
interface ScoreChange {
  visitorId: string;
  identityId: string | null;
  prev: number;
  next: number;
}

/**
 * Profile rebuild (Phase 3). For the target site, aggregate recent
 * `analytics_events` per `visitorId` into `visitor_profiles` (idempotent upsert
 * on (site, visitor)), preserving any `identityId` already linked, then apply
 * the site's active `scoring_rules` → a score.
 *
 * Window: re-rolls the last `PROFILE_REBUILD_LOOKBACK_HOURS` (default 720h/30d)
 * so recent visitors get fresh stats. Stats are absolute recomputes over the
 * window, so re-running is safe (idempotent). The identity link + company are
 * created by the identify path (API), not here — this job only reads them for
 * scoring.
 */
export async function processProfileRebuild(
  job: Job<{ siteId: string }>,
  workflowQueue?: Queue,
): Promise<{ profiles: number; scored: number }> {
  const siteId = job.data.siteId;
  if (!siteId) return { profiles: 0, scored: 0 };

  const lookbackHours = Number(process.env.PROFILE_REBUILD_LOOKBACK_HOURS ?? "720") || 720;
  const since = new Date(Date.now() - lookbackHours * 3_600_000);

  // 1. Per-visitor aggregate from raw events (pageviews drive the stats).
  const agg = await db
    .select({
      visitorId: analyticsEvents.visitorId,
      pageviews: sql<number>`count(*) filter (where ${analyticsEvents.type} = 'pageview')::int`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
      firstSeen: sql<Date>`min(${analyticsEvents.ts})`,
      lastSeen: sql<Date>`max(${analyticsEvents.ts})`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.siteId, siteId), gte(analyticsEvents.ts, since)))
    .groupBy(analyticsEvents.visitorId);

  if (agg.length === 0) {
    console.log(`[worker:profile-rebuild] no events for site ${siteId} in the last ${lookbackHours}h`);
    // Still run scoring on any existing profiles (a rule/identity may have changed).
    const { scored, changes } = await applyScoring(siteId);
    await fireScoreThresholds(siteId, changes, workflowQueue);
    return { profiles: 0, scored };
  }

  // 2. Last source/device per visitor (from the most recent event).
  const lastRows = await db.execute<{
    visitor_id: string;
    source: string | null;
    device_type: string | null;
  }>(sql`
    select distinct on (visitor_id) visitor_id, source, device_type
    from ob_cms.analytics_events
    where site_id = ${siteId} and ts >= ${since}
    order by visitor_id, ts desc
  `);
  const lastByVisitor = new Map<string, { source: string | null; device: string | null }>();
  for (const r of lastRows.rows ?? []) {
    lastByVisitor.set(r.visitor_id, { source: r.source, device: r.device_type });
  }

  // 3. Top paths per visitor (by pageviews, capped at 5).
  const pathRows = await db.execute<{ visitor_id: string; path: string; views: number }>(sql`
    select visitor_id, path, count(*)::int as views
    from ob_cms.analytics_events
    where site_id = ${siteId} and ts >= ${since} and type = 'pageview'
    group by visitor_id, path
  `);
  const topByVisitor = new Map<string, Array<{ path: string; views: number }>>();
  for (const r of pathRows.rows ?? []) {
    const list = topByVisitor.get(r.visitor_id) ?? [];
    list.push({ path: r.path, views: Number(r.views) });
    topByVisitor.set(r.visitor_id, list);
  }

  let profiles = 0;
  for (const r of agg) {
    const last = lastByVisitor.get(r.visitorId);
    const topPaths = (topByVisitor.get(r.visitorId) ?? [])
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
    await db
      .insert(visitorProfiles)
      .values({
        id: generateKSUIDWithPrefixSync("vpr"),
        siteId,
        visitorId: r.visitorId,
        firstSeen: r.firstSeen ? new Date(r.firstSeen) : null,
        lastSeen: r.lastSeen ? new Date(r.lastSeen) : null,
        sessions: Number(r.sessions),
        pageviews: Number(r.pageviews),
        lastSource: last?.source ?? null,
        lastDevice: last?.device ?? null,
        topPaths,
      })
      .onConflictDoUpdate({
        target: [visitorProfiles.siteId, visitorProfiles.visitorId],
        set: {
          // Preserve identityId (linked by the identify path) — do NOT overwrite.
          firstSeen: r.firstSeen ? new Date(r.firstSeen) : null,
          lastSeen: r.lastSeen ? new Date(r.lastSeen) : null,
          sessions: Number(r.sessions),
          pageviews: Number(r.pageviews),
          lastSource: last?.source ?? null,
          lastDevice: last?.device ?? null,
          topPaths,
          updatedAt: new Date(),
        },
      });
    profiles++;
  }

  const { scored, changes } = await applyScoring(siteId);
  await fireScoreThresholds(siteId, changes, workflowQueue);
  console.log(
    `[worker:profile-rebuild] site ${siteId}: ${profiles} profiles, ${scored} scored (job #${job.id})`,
  );
  return { profiles, scored };
}

/**
 * PHASE-5: fire the `score_threshold` workflow trigger for every profile whose
 * score CROSSED UP through the workflow's configured threshold this run
 * (prev < threshold <= next). Best-effort — never throws.
 */
async function fireScoreThresholds(
  siteId: string,
  changes: ScoreChange[],
  workflowQueue?: Queue,
): Promise<void> {
  if (!workflowQueue || changes.length === 0) return;
  // Load active score_threshold workflows so we enqueue only the subjects that
  // crossed EACH workflow's own threshold this run (prev < T <= next).
  const wfs = (
    await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.siteId, siteId), eq(workflows.status, "active")))
  ).filter((w) => !w.deletedAt && (w.trigger as { type?: string } | null)?.type === "score_threshold");
  for (const wf of wfs) {
    const threshold = Number((wf.trigger as { config?: Record<string, unknown> }).config?.threshold ?? 0);
    const crossers = changes.filter((c) => c.prev < threshold && c.next >= threshold);
    if (crossers.length === 0) continue;
    // Pin to THIS workflow via an id match so enqueueWorkflowRuns targets it.
    await enqueueWorkflowRuns(
      workflowQueue,
      siteId,
      "score_threshold",
      crossers.map((c) => ({ visitorId: c.visitorId, identityId: c.identityId })),
      (cfg) => Number(cfg.threshold ?? 0) === threshold,
    );
  }
}

/**
 * Apply the site's active scoring rules to every profile → a summed score.
 * Loads profiles joined to identity/company, builds a ProfileView, sums the
 * points of every matching active rule, and updates `score`.
 */
async function applyScoring(siteId: string): Promise<{ scored: number; changes: ScoreChange[] }> {
  const rules = (
    await db
      .select()
      .from(scoringRules)
      .where(and(eq(scoringRules.siteId, siteId), eq(scoringRules.active, "true")))
  ).filter((r) => !r.deletedAt);

  const rows = await db
    .select({
      id: visitorProfiles.id,
      visitorId: visitorProfiles.visitorId,
      prevScore: visitorProfiles.score,
      pageviews: visitorProfiles.pageviews,
      sessions: visitorProfiles.sessions,
      source: visitorProfiles.lastSource,
      device: visitorProfiles.lastDevice,
      identityId: visitorProfiles.identityId,
      topPaths: visitorProfiles.topPaths,
      email: identities.primaryEmail,
      companyId: identities.companyId,
      companyDomain: companies.domain,
    })
    .from(visitorProfiles)
    .leftJoin(identities, eq(identities.id, visitorProfiles.identityId))
    .leftJoin(companies, eq(companies.id, identities.companyId))
    .where(eq(visitorProfiles.siteId, siteId));

  let scored = 0;
  const changes: ScoreChange[] = [];
  for (const r of rows) {
    const view: ProfileView = {
      pageviews: r.pageviews,
      sessions: r.sessions,
      score: 0,
      source: r.source,
      device: r.device,
      isIdentified: !!r.identityId,
      hasCompany: !!r.companyId,
      paths: (r.topPaths ?? []).map((p) => p.path.toLowerCase()),
      email: r.email ?? null,
      companyDomain: r.companyDomain ?? null,
    };
    let score = 0;
    for (const rule of rules) {
      if (evalCondition(rule.condition as Condition, view)) score += rule.points;
    }
    await db
      .update(visitorProfiles)
      .set({ score, updatedAt: new Date() })
      .where(eq(visitorProfiles.id, r.id));
    if (score !== r.prevScore) {
      changes.push({ visitorId: r.visitorId, identityId: r.identityId ?? null, prev: r.prevScore, next: score });
    }
    scored++;
  }
  return { scored, changes };
}

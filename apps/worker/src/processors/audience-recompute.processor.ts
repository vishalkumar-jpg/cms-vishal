import type { Job, Queue } from "bullmq";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/db";
import {
  audienceDefinitions,
  audienceMemberships,
  companies,
  identities,
  visitorProfiles,
} from "../db/schema";
import { generateKSUIDWithPrefixSync } from "../db/ksuid";
import { evalGroup, type ProfileView, type RuleGroup } from "../db/rules";
import { enqueueWorkflowRuns } from "../db/workflow-triggers";

/**
 * Audience recompute (Phase 3). Evaluate a site's audience definition(s) against
 * its `visitor_profiles` (+ identity/company) and rewrite `audience_memberships`
 * via delete-all-then-insert per audience (idempotent). Pass `audienceId` for a
 * single audience; omit it to recompute every (non-deleted) audience of the site.
 */
export async function processAudienceRecompute(
  job: Job<{ siteId: string; audienceId?: string }>,
  workflowQueue?: Queue,
): Promise<{ audiences: number; members: number }> {
  const { siteId, audienceId } = job.data;
  if (!siteId) return { audiences: 0, members: 0 };

  const defs = (
    await db
      .select()
      .from(audienceDefinitions)
      .where(
        audienceId
          ? and(eq(audienceDefinitions.siteId, siteId), eq(audienceDefinitions.id, audienceId))
          : and(eq(audienceDefinitions.siteId, siteId), isNull(audienceDefinitions.deletedAt)),
      )
  ).filter((d) => !d.deletedAt);

  if (defs.length === 0) return { audiences: 0, members: 0 };

  // Load the site's profiles once (shared across every audience).
  const profileRows = await db
    .select({
      id: visitorProfiles.id,
      visitorId: visitorProfiles.visitorId,
      pageviews: visitorProfiles.pageviews,
      sessions: visitorProfiles.sessions,
      score: visitorProfiles.score,
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

  const profiles = profileRows.map((r) => ({
    row: r,
    view: {
      pageviews: r.pageviews,
      sessions: r.sessions,
      score: r.score,
      source: r.source,
      device: r.device,
      isIdentified: !!r.identityId,
      hasCompany: !!r.companyId,
      paths: (r.topPaths ?? []).map((p) => p.path.toLowerCase()),
      email: r.email ?? null,
      companyDomain: r.companyDomain ?? null,
    } satisfies ProfileView,
  }));

  let members = 0;
  // PHASE-5: collect visitors newly-added to an audience this run, to fire the
  // `audience_enters` workflow trigger (best-effort) after the rebuild.
  const newEntrants: Array<{ audienceId: string; visitorId: string; identityId: string | null }> = [];
  for (const def of defs) {
    const rules = def.rules as RuleGroup;
    // Prior members (to detect newcomers for the audience_enters trigger).
    const prior = new Set(
      (
        await db
          .select({ visitorId: audienceMemberships.visitorId })
          .from(audienceMemberships)
          .where(eq(audienceMemberships.audienceId, def.id))
      ).map((r) => r.visitorId),
    );
    // Rebuild memberships: delete-all-then-insert (idempotent).
    await db.delete(audienceMemberships).where(eq(audienceMemberships.audienceId, def.id));
    const matched = profiles.filter((p) => evalGroup(rules, p.view));
    if (matched.length > 0) {
      await db.insert(audienceMemberships).values(
        matched.map((p) => ({
          id: generateKSUIDWithPrefixSync("ame"),
          siteId,
          audienceId: def.id,
          visitorProfileId: p.row.id,
          visitorId: p.row.visitorId,
          identityId: p.row.identityId ?? null,
        })),
      );
    }
    for (const p of matched) {
      if (!prior.has(p.row.visitorId)) {
        newEntrants.push({
          audienceId: def.id,
          visitorId: p.row.visitorId,
          identityId: p.row.identityId ?? null,
        });
      }
    }
    members += matched.length;
  }

  // Fire audience_enters workflows for the newcomers (best-effort, never throws).
  if (workflowQueue && newEntrants.length > 0) {
    const byAudience = new Map<string, typeof newEntrants>();
    for (const e of newEntrants) {
      const list = byAudience.get(e.audienceId) ?? [];
      list.push(e);
      byAudience.set(e.audienceId, list);
    }
    for (const [aud, entrants] of byAudience) {
      await enqueueWorkflowRuns(
        workflowQueue,
        siteId,
        "audience_enters",
        entrants.map((e) => ({ visitorId: e.visitorId, identityId: e.identityId })),
        (cfg) => cfg.audienceId === aud,
      );
    }
  }

  console.log(
    `[worker:audience-recompute] site ${siteId}: ${defs.length} audiences, ${members} members (job #${job.id})`,
  );
  return { audiences: defs.length, members };
}

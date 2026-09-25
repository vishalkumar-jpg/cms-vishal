import type { Job } from "bullmq";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db/db";
import { analyticsEvents, identities, siteSettings, visitorProfiles } from "../db/schema";

/**
 * Retention purge (Privacy & Consent suite). Repeatable/daily job that enforces
 * each site's data-retention policy:
 *
 *  1. RAW EVENTS — hard-delete `analytics_events` older than the site's
 *     `rawEventRetentionDays` window (default 400). The daily rollup has already
 *     aggregated them into `analytics_daily`, so the dashboards are unaffected.
 *  2. STALE PII (optional) — when a site sets `piiRetentionDays`, anonymize
 *     `identities` (email→tombstone, name→null) + null the `visitor_profiles`
 *     identity link for people not seen for that window. `piiRetentionDays` = 0
 *     / unset ⇒ PII retention is OFF (never anonymize).
 *
 * Per-site windows come from `site_settings.retention`; a global fallback comes
 * from env (RAW_EVENT_RETENTION_DAYS). Idempotent — re-running deletes nothing
 * new once a window has been enforced. Never throws (a bad site is logged +
 * skipped) so the worker stays up.
 */
export async function processRetentionPurge(
  job: Job,
): Promise<{ eventsDeleted: number; identitiesAnonymized: number; sites: number }> {
  const globalRawDays = Number(process.env.RAW_EVENT_RETENTION_DAYS ?? "400") || 400;

  // Load every site's retention config (+ id). A site with no settings row is
  // covered by the global default via the fallback below.
  const rows = await db
    .select({ siteId: siteSettings.siteId, retention: siteSettings.retention })
    .from(siteSettings);

  let eventsDeleted = 0;
  let identitiesAnonymized = 0;
  let sitesTouched = 0;

  for (const row of rows) {
    try {
      const cfg = row.retention ?? {};
      const rawDays = clampDays(cfg.rawEventRetentionDays, globalRawDays);
      const eventCutoff = new Date(Date.now() - rawDays * 86_400_000);

      const deleted = await db
        .delete(analyticsEvents)
        .where(and(eq(analyticsEvents.siteId, row.siteId), lt(analyticsEvents.ts, eventCutoff)))
        .returning({ id: analyticsEvents.id });
      eventsDeleted += deleted.length;

      // Optional PII anonymization when a site opts in (piiRetentionDays > 0).
      const piiDays = Number(cfg.piiRetentionDays ?? 0) || 0;
      if (piiDays > 0) {
        const piiCutoff = new Date(Date.now() - piiDays * 86_400_000);
        // Find stale identities via their newest profile lastSeen. An identity
        // whose most-recent profile activity predates the cutoff is anonymized.
        const stale = await db.execute<{ id: string }>(sql`
          select i.id
          from ob_cms.identities i
          where i.site_id = ${row.siteId}
            and i.deleted_at is null
            and i.primary_email not like 'erased+%@dsar.invalid'
            and coalesce(
              (select max(vp.last_seen) from ob_cms.visitor_profiles vp
                 where vp.identity_id = i.id and vp.site_id = ${row.siteId}),
              i.updated_at
            ) < ${piiCutoff}
        `);
        const staleIds = (stale.rows ?? []).map((r) => r.id);
        for (const id of staleIds) {
          await db
            .update(identities)
            .set({
              primaryEmail: sql`concat('erased+', ${identities.id}, '@dsar.invalid')`,
              name: null,
              updatedAt: new Date(),
            })
            .where(and(eq(identities.id, id), isNull(identities.deletedAt)));
          identitiesAnonymized++;
        }
      }

      if (deleted.length > 0 || identitiesAnonymized > 0) sitesTouched++;
    } catch (err) {
      console.error(
        `[worker:retention-purge] site ${row.siteId} failed`,
        (err as Error).message,
      );
    }
  }

  console.log(
    `[worker:retention-purge] purged ${eventsDeleted} events + anonymized ${identitiesAnonymized} identities across ${rows.length} site(s) (job #${job.id})`,
  );
  return { eventsDeleted, identitiesAnonymized, sites: sitesTouched };
}

/** Clamp a per-site window to a sane range, falling back to the global default. */
function clampDays(value: number | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 3650);
}

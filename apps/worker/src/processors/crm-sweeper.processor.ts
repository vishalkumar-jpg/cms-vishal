import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import type { Queue } from "bullmq";
import { db } from "../db/db";
import { formSubmissions } from "../db/schema";

const STUCK_AFTER_MS = 60_000;

/**
 * forms→CRM sweeper (FORM-10 safety net). A repeatable job that finds
 * non-spam submissions still in `stored`/`failed`/`delivering` whose delivery
 * job vanished (Redis flush / enqueue failure) and re-enqueues them. Postgres is
 * the source of truth, so even a wiped Redis never loses a lead.
 */
export async function processCrmSweeper(crmQueue: Queue): Promise<{ requeued: number }> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
  const stuck = await db
    .select()
    .from(formSubmissions)
    .where(
      and(
        inArray(formSubmissions.status, ["stored", "failed", "delivering"]),
        eq(formSubmissions.isSpam, false),
        isNull(formSubmissions.deletedAt),
        lt(formSubmissions.updatedAt, cutoff),
      ),
    )
    .limit(200);

  let requeued = 0;
  for (const row of stuck) {
    await crmQueue.add(
      "deliver",
      { submissionId: row.id, siteId: row.siteId, formId: row.formId },
      { jobId: `crm:sweep:${row.id}`, attempts: 5, backoff: { type: "exponential", delay: 5000 } },
    );
    requeued++;
  }
  if (requeued > 0) {
    console.log(`[worker] crm-sweeper re-enqueued ${requeued} stuck submission(s)`);
  }
  return { requeued };
}

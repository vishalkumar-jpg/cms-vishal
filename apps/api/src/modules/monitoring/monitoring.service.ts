import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { isHomepageSlug, migrate, type SerializedLayout } from "@ob-cms/block-schema";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  brokenLinks,
  formSubmissions,
  linkChecks,
  media,
  pageAudits,
  pages,
  runtimeErrors,
  siteSettings,
  sites,
  type BrokenLinkRow,
  type FormSubmissionRow,
  type LinkCheckRow,
  type PageAuditRow,
  type RuntimeErrorRow,
  type SiteRow,
} from "@database/schema";
import { generateKSUIDWithPrefixSync } from "@utils/ksuid.utils";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { QueueService } from "@modules/queue/queue.service";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import { PagesService } from "@modules/pages/pages.service";
import { applicableFixes, getFix } from "./autofix/registry";
import { fixRuleIds, type AutoFix, type FixCategory, type FixChange } from "./autofix/types";
import type { PageAuditRecommendation } from "@database/schema/monitoring.schema";
import type { PageAuditConfig } from "@database/schema/site-settings.schema";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type {
  AuditsQueryDto,
  CrmDeliveriesQueryDto,
  ErrorsQueryDto,
  IngestErrorDto,
  LinksQueryDto,
  RunAuditDto,
  UpdateAuditConfigDto,
} from "./dto/monitoring.dto";

/** Cap on how many published pages one "scan all pages" run enqueues. */
const BULK_AUDIT_MAX_PAGES = Number(process.env.PAGE_AUDIT_MAX_PAGES ?? "50");

/** Rows stuck in pending/running longer than this are ignored by the in-flight guard. */
const PAGE_AUDIT_STALE_MS =
  Number(process.env.PAGE_AUDIT_STALE_MS ?? "0") ||
  Number(process.env.PAGE_AUDIT_TIMEOUT_MS ?? "60000") * 3 + 120_000;

/** Mean of the non-null numbers (rounded); null when there are none. */
const mean = (values: (number | null)[]): number | null => {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
};

/** Progress summary for a bulk "scan all pages" run. */
export interface AuditBatchProgress {
  batchId: string;
  total: number;
  completed: number;
  /** Rows the worker is actively auditing right now. */
  running: number;
  /** Rows queued but not yet picked up. */
  pending: number;
  /** Rows that errored during the run. */
  failed: number;
  /** Rows skipped (e.g. Chromium unavailable in this environment). */
  skipped: number;
  rows: PageAuditRow[];
}

/** Result of applying one or more auto-fixes to an audit's page. */
export interface ApplyFixResult {
  /** Layout prop changes written to the page draft. */
  applied: number;
  /** Images queued for re-encoding via the image pipeline. */
  queued: number;
  pageId: string | null;
  /** The rule ids that produced work. */
  ruleIds: string[];
}

/** The four Lighthouse category scores (0..100, null until audited). */
export interface AuditScores {
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
}

/** One page in the dashboard rollup: its latest audit + the previous one (trend). */
export interface DashboardPage extends AuditScores {
  auditId: string;
  pageId: string | null;
  path: string;
  status: string;
  lcp: number | null;
  cls: number | null;
  ranAt: string;
  /** Mean of the available category scores for the latest audit (null if none). */
  average: number | null;
  /** The previous audit's scores + average, for trend arrows (null if first scan). */
  previous: (AuditScores & { average: number | null; ranAt: string }) | null;
  /** Distinct Lighthouse categories flagged on the latest audit (for filtering). */
  flaggedCategories: string[];
  /**
   * Wall-clock of the latest audit (queue + Lighthouse run), derived from the
   * existing `createdAt`→`ranAt` timestamps. Null until the row completes.
   */
  durationMs: number | null;
}

/** A single threshold breach on a page's latest scan (Performance Alerts). */
export interface PageAuditAlertBreach {
  /** performance | accessibility | seo | bestPractices | lcp | cls */
  metric: string;
  value: number | null;
  threshold: number;
  /** True when the metric is "lower is better" (LCP/CLS). */
  lowerIsBetter: boolean;
}

/** A page whose latest scan fell below one or more configured thresholds. */
export interface PageAuditAlert {
  path: string;
  auditId: string;
  breaches: PageAuditAlertBreach[];
}

/** A page's latest-vs-previous average movement (Regression Detection). */
export interface RegressionPage {
  path: string;
  auditId: string;
  average: number | null;
  previousAverage: number | null;
  /** average − previousAverage (negative = regression). */
  delta: number;
}

/** Regression rollup surfaced on the dashboard. */
export interface AuditRegressions {
  /** Largest average drops between the last two scans. */
  largestDrops: RegressionPage[];
  /** Pages that were passing (avg ≥ fail line) and are now below it. */
  newlyFailing: RegressionPage[];
  /** Pages whose average improved meaningfully. */
  improving: RegressionPage[];
}

/** Site-wide PageSpeed dashboard rollup, derived from existing page_audits rows. */
export interface AuditDashboardSummary {
  /** Overall health = mean of every page's latest average (0..100, null if none). */
  health: number | null;
  /** Same, for each page's PREVIOUS scan — so the UI can show a health trend. */
  previousHealth: number | null;
  averages: AuditScores;
  counts: {
    pages: number;
    completed: number;
    running: number;
    pending: number;
    failed: number;
    skipped: number;
  };
  /** Highest / lowest by latest average (completed pages only), capped. */
  best: DashboardPage[];
  worst: DashboardPage[];
  /** Every page's latest audit (one row per path), newest scan first. */
  pages: DashboardPage[];
  /** Most recent completed scan across the site (ISO), null when none. */
  lastScanAt: string | null;
  /** Mean / most-recent scan wall-clock (ms) across completed pages. */
  avgScanDurationMs: number | null;
  lastScanDurationMs: number | null;
  /** Stored schedule config (null when unset) + the computed next run (ISO). */
  schedule: PageAuditConfig["schedule"] | null;
  nextScanAt: string | null;
  /** Stored alert config (null when unset). */
  alerts: PageAuditConfig["alerts"] | null;
  /** Pages whose latest scan breached a configured threshold. */
  alertingPages: PageAuditAlert[];
  /** Largest regressions / newly-failing / improving pages. */
  regressions: AuditRegressions;
}

/** One auto-fix as surfaced for an audit, with the changes planned on the draft. */
export interface AuditFixView {
  ruleId: string;
  category: FixCategory;
  title: string;
  description: string;
  /** Concrete changes this fix would make to the current draft. */
  changeCount: number;
  /** Applyable now (not manual + has changes + the page draft is resolvable). */
  applicable: boolean;
  /** A capped sample of the changes for preview. */
  changes: FixChange[];
}

/** Preview of the auto-fixes available for an audit's page. */
export interface AuditFixesView {
  auditId: string;
  pageId: string | null;
  /** False when the audit has no editable page (e.g. site root, no index page). */
  pageResolved: boolean;
  fixes: AuditFixView[];
}

/** A safe projection of a CRM delivery row (no raw lead PII in `data`). */
export interface CrmDeliveryView {
  id: string;
  formId: string;
  status: string;
  deliveryAttempts: number;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
  isSpam: boolean;
}

/**
 * Monitoring hub service (#29/#37/#30). Site-scoped reads go through
 * ScopedRepository; the @Public error ingest resolves the site from the Host
 * header (SiteResolver) and uses the raw `db` (no request TenantContext there).
 */
@Injectable()
export class MonitoringService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly resolver: SiteResolver,
    private readonly pages: PagesService,
  ) {}

  // --- #29 CRM-sync monitoring (reads form_submissions) ---------------------

  /**
   * List the site's forms→CRM deliveries (newest first). `form_submissions` IS
   * the CRM sync log — its status/attempts/lastError/deliveredAt columns are the
   * delivery state-machine the worker advances.
   */
  async listCrmDeliveries(q: CrmDeliveriesQueryDto): Promise<{
    rows: CrmDeliveryView[];
    hasMore: boolean;
    limit: number;
    offset: number;
  }> {
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const extra = q.status ? eq(formSubmissions.status, q.status) : undefined;
    const rows = await this.repo.db
      .select()
      .from(formSubmissions)
      .where(this.repo.scope(formSubmissions, extra))
      .orderBy(desc(formSubmissions.createdAt))
      .limit(limit + 1)
      .offset(offset);
    const hasMore = rows.length > limit;
    return {
      rows: rows.slice(0, limit).map((r) => this.crmView(r)),
      hasMore,
      limit,
      offset,
    };
  }

  private crmView(r: FormSubmissionRow): CrmDeliveryView {
    return {
      id: r.id,
      formId: r.formId,
      status: r.status,
      deliveryAttempts: r.deliveryAttempts,
      lastError: r.lastError ?? null,
      deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
      isSpam: r.isSpam,
    };
  }

  /**
   * Retry a CRM delivery: re-enqueue the EXISTING delivery job (we never
   * reimplement delivery here — the worker is the source of truth). Resets the
   * row to `stored` so the worker's idempotency check re-attempts it.
   */
  async retryCrmDelivery(id: string, actor: AuthUser): Promise<{ enqueued: boolean; jobId: string | null }> {
    const [row] = await this.repo.db
      .select()
      .from(formSubmissions)
      .where(this.repo.scope(formSubmissions, eq(formSubmissions.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Delivery not found");

    await this.repo.db
      .update(formSubmissions)
      .set({ status: "stored", lastError: null, updatedBy: actor.userId })
      .where(this.repo.scope(formSubmissions, eq(formSubmissions.id, id)));

    const jobId = await this.queue.enqueueCrmDelivery({
      submissionId: row.id,
      siteId: row.siteId,
      formId: row.formId,
    });
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "crm_delivery.retried",
      category: "monitoring",
      entityType: "form_submission",
      entityId: row.id,
      metadata: { jobId },
    });
    return { enqueued: true, jobId: jobId ?? null };
  }

  // --- #37 Runtime error capture --------------------------------------------

  /**
   * Ingest a runtime error (@Public). Resolves the site from the request Host
   * and DEDUPES by (siteId, source, message, url): a repeat increments `count` +
   * bumps `lastSeen` instead of inserting a new row. Unknown host → silently
   * dropped (returns deduped:false, id:null) so a bad host never errors clients.
   */
  async ingestError(
    host: string | undefined,
    dto: IngestErrorDto,
    userAgent: string | undefined,
  ): Promise<{ deduped: boolean; id: string | null }> {
    const site = await this.resolver.resolve(host);
    if (!site) return { deduped: false, id: null };

    const source = dto.source ?? "renderer";
    const url = dto.url ?? null;

    // Dedupe lookup on the natural key.
    const [existing] = await this.db
      .select({ id: runtimeErrors.id })
      .from(runtimeErrors)
      .where(
        and(
          eq(runtimeErrors.siteId, site.id),
          eq(runtimeErrors.source, source),
          eq(runtimeErrors.message, dto.message),
          url === null ? sql`${runtimeErrors.url} is null` : eq(runtimeErrors.url, url),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(runtimeErrors)
        .set({ count: sql`${runtimeErrors.count} + 1`, lastSeen: new Date() })
        .where(eq(runtimeErrors.id, existing.id));
      return { deduped: true, id: existing.id };
    }

    const now = new Date();
    const [row] = await this.db
      .insert(runtimeErrors)
      .values({
        siteId: site.id,
        source,
        message: dto.message,
        stack: dto.stack ?? null,
        url,
        userAgent: userAgent?.slice(0, 1000) ?? null,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      })
      .returning({ id: runtimeErrors.id });
    return { deduped: false, id: row?.id ?? null };
  }

  /** List captured errors for the active site (most-recently-seen first). */
  async listErrors(q: ErrorsQueryDto): Promise<{
    rows: RuntimeErrorRow[];
    hasMore: boolean;
    limit: number;
    offset: number;
  }> {
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const extra = q.source ? eq(runtimeErrors.source, q.source) : undefined;
    const rows = await this.repo.db
      .select()
      .from(runtimeErrors)
      .where(this.repo.scope(runtimeErrors, extra))
      .orderBy(desc(runtimeErrors.lastSeen))
      .limit(limit + 1)
      .offset(offset);
    const hasMore = rows.length > limit;
    return { rows: rows.slice(0, limit), hasMore, limit, offset };
  }

  // --- #30 Page audits / certification (real Lighthouse) --------------------

  /**
   * Resolve the public URL + Host header for a page audit.
   * In local/dev, navigate to `http://<subdomain>.localhost:<port><path>` so
   * Chrome does not need a Host override (which triggers CHROME_INTERSTITIAL_ERROR).
   */
  private resolveAuditTarget(
    site: SiteRow,
    path: string,
  ): { url: string; hostHeader: string } {
    const normPath = path.startsWith("/") ? path : `/${path}`;
    const { baseUrl, hostHeader } = this.resolveSiteBase(site);
    return { url: `${baseUrl}${normPath}`, hostHeader };
  }

  /**
   * Public origin used for Lighthouse / link-check in local/dev.
   * Prefer AUDIT_BASE_URL (page audits) over RENDERER_BASE_URL / RENDERER_INTERNAL_URL.
   * Production paths use primaryDomain/customDomain instead — this is the fallback only.
   */
  private auditBaseFromEnv(): string {
    return (
      process.env.AUDIT_BASE_URL ||
      process.env.RENDERER_BASE_URL ||
      process.env.RENDERER_INTERNAL_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
  }

  // --- #30 Page audits / certification (list) -------------------------------

  /**
   * List audit rows (newest first), optionally filtered to one path, a status,
   * and/or a `ranAt` date range. The date range powers the Scan History view's
   * date filter; all filters are additive and optional.
   */
  async listAudits(q: AuditsQueryDto): Promise<{
    rows: PageAuditRow[];
    hasMore: boolean;
    limit: number;
    offset: number;
  }> {
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const from = this.parseAuditDate(q.from, "from");
    const to = this.parseAuditDate(q.to, "to");
    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException("`from` must be before or equal to `to`");
    }

    const filters = [
      q.path ? eq(pageAudits.path, q.path) : undefined,
      q.status ? eq(pageAudits.status, q.status) : undefined,
      from ? gte(pageAudits.ranAt, from) : undefined,
      to ? lte(pageAudits.ranAt, to) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    const rows = await this.repo.db
      .select()
      .from(pageAudits)
      .where(this.repo.scope(pageAudits, filters.length ? and(...filters) : undefined))
      .orderBy(desc(pageAudits.ranAt))
      .limit(limit + 1)
      .offset(offset);
    const hasMore = rows.length > limit;
    return { rows: rows.slice(0, limit), hasMore, limit, offset };
  }

  /** How many pages the best/worst lists surface. */
  private static readonly DASHBOARD_TOP_N = 5;

  /**
   * PostgreSQL advisory-lock class id for bulk Scan All (feature #30).
   * `pg_advisory_xact_lock(class, hashtext(siteId))` — two-key form avoids
   * cross-feature collisions; key2 collisions between sites are negligible at CMS scale.
   */
  private static readonly BULK_AUDIT_LOCK_CLASS = 30;

  /**
   * Latest (+ previous) audit row per path. Uses LATERAL LIMIT 2 so each path
   * hits `pau_site_path_idx` (site_id, path, ran_at) instead of sorting the
   * site's full audit history (window+IN seq-scanned at scale in EXPLAIN ANALYZE).
   */
  private async fetchDashboardAuditRows(): Promise<PageAuditRow[]> {
    const siteId = this.repo.siteId;
    const idResult = await this.repo.db.execute<{ id: string }>(sql`
      SELECT pa.id
      FROM (
        SELECT DISTINCT path
        FROM ob_cms.page_audits
        WHERE site_id = ${siteId} AND deleted_at IS NULL
      ) paths(path)
      CROSS JOIN LATERAL (
        SELECT inner_pa.id
        FROM ob_cms.page_audits inner_pa
        WHERE inner_pa.site_id = ${siteId}
          AND inner_pa.deleted_at IS NULL
          AND inner_pa.path = paths.path
        ORDER BY inner_pa.ran_at DESC
        LIMIT 2
      ) pa
    `);
    const ids = idResult.rows.map((r) => r.id);
    if (ids.length === 0) return [];
    return this.repo.db
      .select()
      .from(pageAudits)
      .where(this.repo.scope(pageAudits, inArray(pageAudits.id, ids)))
      .orderBy(desc(pageAudits.ranAt));
  }

  /**
   * Site-wide PageSpeed dashboard rollup, derived entirely from existing
   * `page_audits` rows (no new storage). LATERAL LIMIT 2 per path returns the latest
   * + previous scan per path, then we compute per-page averages/trend and site
   * aggregates (health, category averages, counts, best/worst).
   */
  async getDashboardSummary(): Promise<AuditDashboardSummary> {
    const config = await this.getAuditConfig();
    const rows = await this.fetchDashboardAuditRows();
    const byPath = new Map<string, PageAuditRow[]>();
    for (const r of rows) {
      const list = byPath.get(r.path) ?? [];
      if (list.length < 2) list.push(r);
      byPath.set(r.path, list);
    }

    const pages: DashboardPage[] = [];
    for (const [, list] of byPath) {
      const latest = list[0];
      const prev = list[1] ?? null;
      pages.push({
        auditId: latest.id,
        pageId: latest.pageId,
        path: latest.path,
        status: latest.status,
        performanceScore: latest.performanceScore,
        accessibilityScore: latest.accessibilityScore,
        seoScore: latest.seoScore,
        bestPracticesScore: latest.bestPracticesScore,
        lcp: latest.lcp,
        cls: latest.cls,
        ranAt: latest.ranAt.toISOString(),
        average: this.scoreAverage(latest),
        previous: prev
          ? {
              performanceScore: prev.performanceScore,
              accessibilityScore: prev.accessibilityScore,
              seoScore: prev.seoScore,
              bestPracticesScore: prev.bestPracticesScore,
              average: this.scoreAverage(prev),
              ranAt: prev.ranAt.toISOString(),
            }
          : null,
        flaggedCategories: this.flaggedCategories(latest),
        durationMs: this.scanDuration(latest),
      });
    }

    pages.sort((a, b) => Date.parse(b.ranAt) - Date.parse(a.ranAt));

    const counts = {
      pages: pages.length,
      completed: pages.filter((p) => p.status === "completed").length,
      running: pages.filter((p) => p.status === "running").length,
      pending: pages.filter((p) => p.status === "pending").length,
      failed: pages.filter((p) => p.status === "failed").length,
      // Legacy `seam` rows are terminal placeholders — bucket with skipped (matches batch progress).
      skipped: pages.filter((p) => p.status === "skipped" || p.status === "seam").length,
    };

    const ranked = pages
      .filter((p) => p.average !== null)
      .sort((a, b) => (b.average as number) - (a.average as number));
    const top = MonitoringService.DASHBOARD_TOP_N;

    const durations = pages
      .map((p) => p.durationMs)
      .filter((d): d is number => typeof d === "number");
    const mostRecentCompleted = pages.reduce<DashboardPage | null>(
      (latest, p) =>
        p.status !== "completed"
          ? latest
          : !latest || p.ranAt > latest.ranAt
            ? p
            : latest,
      null,
    );

    return {
      health: mean(pages.map((p) => p.average)),
      previousHealth: mean(pages.map((p) => p.previous?.average ?? null)),
      averages: {
        performanceScore: mean(pages.map((p) => p.performanceScore)),
        accessibilityScore: mean(pages.map((p) => p.accessibilityScore)),
        seoScore: mean(pages.map((p) => p.seoScore)),
        bestPracticesScore: mean(pages.map((p) => p.bestPracticesScore)),
      },
      counts,
      best: ranked.slice(0, top),
      worst: ranked.slice(Math.max(top, ranked.length - top)).reverse(),
      pages,
      lastScanAt: mostRecentCompleted?.ranAt ?? null,
      avgScanDurationMs: durations.length ? mean(durations) : null,
      lastScanDurationMs: mostRecentCompleted?.durationMs ?? null,
      schedule: config.schedule ?? null,
      nextScanAt: this.computeNextScan(config.schedule, new Date()),
      alerts: config.alerts ?? null,
      alertingPages: this.evaluateAlerts(pages, config.alerts),
      regressions: this.computeRegressions(pages, top),
    };
  }

  /** Wall-clock (ms) of a completed audit — createdAt→ranAt (queue + run). */
  private scanDuration(r: PageAuditRow): number | null {
    if (r.status !== "completed" || !r.createdAt) return null;
    const ms = r.ranAt.getTime() - r.createdAt.getTime();
    return ms >= 0 ? ms : null;
  }

  /** Next scheduled scan (ISO) from the stored schedule, or null when disabled. */
  private computeNextScan(schedule: PageAuditConfig["schedule"], now: Date): string | null {
    if (!schedule?.enabled) return null;
    const hour = schedule.hour ?? 3;
    const next = new Date(now);
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(hour);
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    if (schedule.frequency === "weekly") {
      const dow = schedule.dayOfWeek ?? 1;
      // Advance day-by-day (max 7) until we land on the configured weekday.
      for (let i = 0; i < 7 && next.getUTCDay() !== dow; i++) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
    }
    return next.toISOString();
  }

  /** Latest scans that fall below the configured alert thresholds. */
  private evaluateAlerts(
    pages: DashboardPage[],
    alerts: PageAuditConfig["alerts"],
  ): PageAuditAlert[] {
    if (!alerts?.enabled) return [];
    const out: PageAuditAlert[] = [];
    for (const p of pages) {
      if (p.status !== "completed") continue;
      const breaches: PageAuditAlertBreach[] = [];
      const lower = (metric: string, value: number | null, threshold?: number): void => {
        if (typeof threshold === "number" && typeof value === "number" && value > threshold) {
          breaches.push({ metric, value, threshold, lowerIsBetter: true });
        }
      };
      const higher = (metric: string, value: number | null, threshold?: number): void => {
        if (typeof threshold === "number" && typeof value === "number" && value < threshold) {
          breaches.push({ metric, value, threshold, lowerIsBetter: false });
        }
      };
      higher("performance", p.performanceScore, alerts.performance);
      higher("accessibility", p.accessibilityScore, alerts.accessibility);
      higher("seo", p.seoScore, alerts.seo);
      higher("bestPractices", p.bestPracticesScore, alerts.bestPractices);
      lower("lcp", p.lcp, alerts.lcpMs);
      lower("cls", p.cls, alerts.cls);
      if (breaches.length) out.push({ path: p.path, auditId: p.auditId, breaches });
    }
    return out;
  }

  /** Meaningful average movement between the last two scans per page. */
  private computeRegressions(pages: DashboardPage[], top: number): AuditRegressions {
    const DELTA = 5; // ignore sub-5-point noise
    const FAIL_LINE = 50; // Lighthouse "poor" boundary
    const moved: RegressionPage[] = [];
    for (const p of pages) {
      const cur = p.average;
      const prev = p.previous?.average ?? null;
      if (cur === null || prev === null) continue;
      moved.push({
        path: p.path,
        auditId: p.auditId,
        average: cur,
        previousAverage: prev,
        delta: cur - prev,
      });
    }
    const largestDrops = moved
      .filter((m) => m.delta <= -DELTA)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, top);
    const newlyFailing = moved
      .filter(
        (m) =>
          (m.previousAverage as number) >= FAIL_LINE && (m.average as number) < FAIL_LINE,
      )
      .sort((a, b) => a.delta - b.delta)
      .slice(0, top);
    const improving = moved
      .filter((m) => m.delta >= DELTA)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, top);
    return { largestDrops, newlyFailing, improving };
  }

  // --- #30 PageSpeed schedule + alert config (Phase 5) ----------------------

  /** Read the site's PageSpeed automation config (schedule + alert thresholds). */
  async getAuditConfig(): Promise<PageAuditConfig> {
    const [row] = await this.repo.db
      .select({ config: siteSettings.pageAuditConfig })
      .from(siteSettings)
      .where(this.repo.scope(siteSettings))
      .limit(1);
    return row?.config ?? {};
  }

  /**
   * Update the site's schedule + alert config. Merges over the stored value and
   * preserves `lastScheduledScanAt` (owned by the worker sweep, not the admin).
   */
  async updateAuditConfig(dto: UpdateAuditConfigDto, actor: AuthUser): Promise<PageAuditConfig> {
    const current = await this.getAuditConfig();
    const next: PageAuditConfig = {
      schedule: dto.schedule
        ? { ...dto.schedule, lastScheduledScanAt: current.schedule?.lastScheduledScanAt }
        : current.schedule,
      alerts: dto.alerts ? { ...current.alerts, ...dto.alerts } : current.alerts,
    };

    const updated = await this.repo.db
      .update(siteSettings)
      .set({ pageAuditConfig: next })
      .where(this.repo.scope(siteSettings))
      .returning({ config: siteSettings.pageAuditConfig });
    if (updated.length === 0) throw new NotFoundException("Site settings not found");

    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "page_audit.config_update",
      category: "monitoring",
      entityType: "site_settings",
      entityId: this.repo.siteId,
      metadata: {
        scheduleEnabled: next.schedule?.enabled ?? false,
        alertsEnabled: next.alerts?.enabled ?? false,
      },
    });
    return updated[0].config ?? next;
  }

  /** Mean of a row's four category scores (ignores nulls; null when all null). */
  private scoreAverage(r: PageAuditRow): number | null {
    return mean([r.performanceScore, r.accessibilityScore, r.seoScore, r.bestPracticesScore]);
  }

  /** Distinct Lighthouse categories flagged on a row's recommendations. */
  private flaggedCategories(r: PageAuditRow): string[] {
    const recs = (r.recommendations ?? []) as PageAuditRecommendation[];
    return [...new Set(recs.map((rec) => rec.category).filter(Boolean))];
  }

  /**
   * Run a real page audit (#30): insert a `pending` row, resolve the site's
   * public URL for the path, and enqueue a `page-audit` job. The worker runs
   * Lighthouse and overwrites the row with real scores (`completed`), or marks
   * it `skipped`/`failed` when no headless Chromium is available (it never
   * crashes). See apps/api/PAGE-AUDITS-LIGHTHOUSE.md.
   */
  async runAudit(dto: RunAuditDto, actor: AuthUser): Promise<PageAuditRow> {
    const [site] = await this.db
      .select()
      .from(sites)
      .where(eq(sites.id, this.repo.siteId))
      .limit(1);
    if (!site) throw new NotFoundException("Site not found");

    const path = this.normalizeAuditPath(dto.path);
    const { url, hostHeader } = this.resolveAuditTarget(site, path);

    const [row] = await this.repo.db
      .insert(pageAudits)
      .values({
        ...this.repo.insertDefaults(),
        pageId: dto.pageId ?? null,
        path,
        status: "pending",
        // Scores stay null until the worker writes real Lighthouse numbers.
        performanceScore: null,
        accessibilityScore: null,
        seoScore: null,
        bestPracticesScore: null,
        lcp: null,
        cls: null,
        ranAt: new Date(),
      })
      .returning();

    let jobId: string | undefined;
    try {
      jobId = await this.queue.enqueuePageAudit({
        auditId: row.id,
        siteId: this.repo.siteId,
        path,
        url,
        hostHeader,
      });
    } catch (err) {
      await this.markAuditEnqueueFailed(row.id, err);
      throw err;
    }

    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "page_audit.run",
      category: "monitoring",
      entityType: "page_audit",
      entityId: row.id,
      metadata: { path, url, jobId },
    });
    return row;
  }

  /** Map a page slug to its public path (homepage slugs → `/`). */
  private slugToPath(slug: string): string {
    if (slug === "index" || isHomepageSlug(slug)) return "/";
    return `/${slug.replace(/^\/+/, "")}`;
  }

  /**
   * Scan ALL published pages of the site (#30). Enumerates published pages
   * (same source the broken-link checker uses), inserts one `pending`
   * `page_audits` row per page tagged with a shared `batchId`, and enqueues a
   * `page-audit` job per row — REUSING the existing single-page pipeline (no new
   * queue/processor). Progress is read back via `getBatchProgress`.
   *
   * Concurrency: `pg_advisory_xact_lock(class, hashtext(siteId))` serializes bulk-start
   * per site inside a DB transaction so two concurrent requests cannot both pass
   * the in-flight guard or insert duplicate batches. Redis enqueue runs after
   * commit; per-row enqueue failures mark `failed`, and a total enqueue failure
   * deletes the orphaned batch rows.
   */
  async runBulkAudit(actor: AuthUser): Promise<{ batchId: string; queued: number }> {
    const [site] = await this.db
      .select()
      .from(sites)
      .where(eq(sites.id, this.repo.siteId))
      .limit(1);
    if (!site) throw new NotFoundException("Site not found");

    const batchId = generateKSUIDWithPrefixSync("aub");
    const siteId = this.repo.siteId;
    const staleBefore = new Date(Date.now() - PAGE_AUDIT_STALE_MS);

    // Phase 1 — transactional insert under a per-site advisory lock.
    const { targets, inserted } = await this.db.transaction(async (tx) => {
      // One bulk scan per site at a time; released automatically on commit/rollback.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${MonitoringService.BULK_AUDIT_LOCK_CLASS}, hashtext(${siteId}))`,
      );

      const [inFlight] = await tx
        .select({ id: pageAudits.id })
        .from(pageAudits)
        .where(
          and(
            eq(pageAudits.siteId, siteId),
            isNull(pageAudits.deletedAt),
            inArray(pageAudits.status, ["pending", "running"]),
            gte(pageAudits.ranAt, staleBefore),
          ),
        )
        .limit(1);
      if (inFlight) {
        throw new BadRequestException("A page scan is already in progress — wait for it to finish.");
      }

      const published = await tx
        .select({ id: pages.id, slug: pages.slug })
        .from(pages)
        .where(and(eq(pages.siteId, siteId), isNull(pages.deletedAt), eq(pages.status, "published")))
        .limit(BULK_AUDIT_MAX_PAGES);

      const byPath = new Map<string, { pageId: string | null; path: string }>();
      for (const p of published) {
        const path = this.slugToPath(p.slug);
        if (!byPath.has(path)) byPath.set(path, { pageId: p.id, path });
      }
      if (!byPath.has("/")) byPath.set("/", { pageId: null, path: "/" });
      const targets = [...byPath.values()];

      const ranAt = new Date();
      const defaults = this.repo.insertDefaults();
      const returned = await tx
        .insert(pageAudits)
        .values(
          targets.map((t) => ({
            ...defaults,
            pageId: t.pageId,
            path: t.path,
            status: "pending",
            batchId,
            ranAt,
          })),
        )
        .returning();
      const byInsertedPath = new Map(returned.map((r) => [r.path, r]));
      const inserted = targets.map((t) => {
        const row = byInsertedPath.get(t.path);
        if (!row) {
          throw new Error(`Bulk insert did not return a row for path ${t.path}`);
        }
        return row;
      });
      return { targets, inserted };
    });

    // Phase 2 — enqueue after commit (Redis is outside the DB transaction).
    let queued = 0;
    for (let i = 0; i < inserted.length; i++) {
      const row = inserted[i];
      const t = targets[i];
      const { url, hostHeader } = this.resolveAuditTarget(site, t.path);
      try {
        await this.queue.enqueuePageAudit({
          auditId: row.id,
          siteId,
          path: t.path,
          url,
          hostHeader,
        });
        queued++;
      } catch (err) {
        await this.markAuditEnqueueFailed(row.id, err);
      }
    }

    if (queued === 0 && inserted.length > 0) {
      // Roll back the orphaned batch so pending rows cannot block future scans.
      await this.repo.db
        .delete(pageAudits)
        .where(this.repo.scope(pageAudits, eq(pageAudits.batchId, batchId)));
      throw new BadRequestException("Could not queue any page audits — check queue connectivity.");
    }

    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "page_audit.scan_all",
      category: "monitoring",
      entityType: "page_audit",
      entityId: batchId,
      metadata: { batchId, queued },
    });
    return { batchId, queued };
  }

  /**
   * Progress for a bulk run: all rows sharing `batchId` (site-scoped) plus
   * completed/pending/skipped counts so the admin can poll a scan to completion.
   */
  async getBatchProgress(batchId: string): Promise<AuditBatchProgress> {
    const rows = await this.repo.db
      .select()
      .from(pageAudits)
      .where(this.repo.scope(pageAudits, eq(pageAudits.batchId, batchId)))
      .orderBy(desc(pageAudits.ranAt));

    let completed = 0;
    let running = 0;
    let pending = 0;
    let failed = 0;
    let skipped = 0;
    for (const r of rows) {
      if (r.status === "completed") completed++;
      else if (r.status === "running") running++;
      else if (r.status === "pending") pending++;
      else if (r.status === "failed") failed++;
      else skipped++; // skipped | seam | anything terminal-but-not-complete
    }
    return { batchId, total: rows.length, completed, running, pending, failed, skipped, rows };
  }

  // --- #30 PageSpeed auto-fixes (Phase 2) -----------------------------------

  /** Cap on how many change lines a preview returns per fix (apply uses all). */
  private static readonly FIX_CHANGE_PREVIEW_CAP = 50;

  /** Fetch a site-scoped audit row or 404. */
  private async getAudit(auditId: string): Promise<PageAuditRow> {
    const [row] = await this.repo.db
      .select()
      .from(pageAudits)
      .where(this.repo.scope(pageAudits, eq(pageAudits.id, auditId)))
      .limit(1);
    if (!row) throw new NotFoundException("Audit not found");
    return row;
  }

  /** The Lighthouse rule ids captured on an audit's recommendations. */
  private recommendationIds(audit: PageAuditRow): string[] {
    return ((audit.recommendations ?? []) as PageAuditRecommendation[]).map((r) => r.id);
  }

  /** Load + migrate the working (draft→published) layout for an audit's page. */
  private async loadAuditPageLayout(
    audit: PageAuditRow,
  ): Promise<{ pageId: string | null; layout: SerializedLayout | null }> {
    if (!audit.pageId) return { pageId: null, layout: null };
    const [page] = await this.repo.db
      .select({ draftLayout: pages.draftLayout, publishedLayout: pages.publishedLayout })
      .from(pages)
      .where(this.repo.scope(pages, eq(pages.id, audit.pageId)))
      .limit(1);
    const raw = page?.draftLayout ?? page?.publishedLayout ?? null;
    return { pageId: audit.pageId, layout: raw ? migrate(raw) : null };
  }

  /**
   * Preview the auto-fixes available for an audit: every registered fix whose
   * rule Lighthouse flagged on this page, planned against the current page draft
   * so the admin sees exactly what applying would change. Pure — nothing is
   * written.
   */
  async previewAuditFixes(auditId: string): Promise<AuditFixesView> {
    const audit = await this.getAudit(auditId);
    const { pageId, layout } = await this.loadAuditPageLayout(audit);
    const fixes = applicableFixes(this.recommendationIds(audit));

    const views: AuditFixView[] = fixes.map((fix) => {
      const changes = layout ? fix.plan(layout).changes : [];
      return {
        ruleId: fix.ruleId,
        category: fix.category,
        title: fix.title,
        description: fix.description,
        changeCount: changes.length,
        applicable: fix.category !== "manual" && changes.length > 0 && !!layout,
        changes: changes.slice(0, MonitoringService.FIX_CHANGE_PREVIEW_CAP),
      };
    });

    return { auditId, pageId, pageResolved: !!layout, fixes: views };
  }

  /**
   * Apply ONE auto-fix to the audit's page. A `layout` fix writes the page DRAFT
   * (never the published layout) through the normal `saveDraft` path (validation
   * + audit + the existing publish/versioning workflow), so the editor still
   * reviews and publishes it. A `media-optimize` fix instead queues the page's
   * images through the existing image pipeline. Manual fixes and no-op plans are
   * rejected / no-ops.
   */
  async applyAuditFix(auditId: string, ruleId: string, actor: AuthUser): Promise<ApplyFixResult> {
    const audit = await this.getAudit(auditId);
    const fix = getFix(ruleId);
    if (!fix) throw new NotFoundException(`Unknown fix '${ruleId}'`);
    if (fix.category === "manual") {
      throw new BadRequestException(`'${ruleId}' is a manual fix and cannot be applied automatically`);
    }
    const flagged = new Set(this.recommendationIds(audit));
    if (!fixRuleIds(fix).some((id) => flagged.has(id))) {
      throw new BadRequestException(`Audit did not flag '${ruleId}' for this page`);
    }

    const { pageId, layout } = await this.loadAuditPageLayout(audit);
    if (!pageId || !layout) throw new BadRequestException("Audit has no editable page draft to fix");

    const plan = fix.plan(layout);
    if (plan.changes.length === 0) return { applied: 0, queued: 0, pageId, ruleIds: [] };

    const { applied, queued } = await this.persistPlan(fix, plan, pageId, actor);
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "page_audit.fix_applied",
      category: "monitoring",
      entityType: "page_audit",
      entityId: auditId,
      metadata: { ruleId: fix.ruleId, pageId, applied, queued },
    });

    return { applied, queued, pageId, ruleIds: [fix.ruleId] };
  }

  /**
   * Apply EVERY `automatic` fix flagged on the audit (skipping `one_click` and
   * `manual`). Layout fixes are folded onto a single working layout and saved
   * once; `media-optimize` fixes queue image work. This reuses the same registry
   * + apply logic as the single-fix path — no separate engine.
   */
  async applyAllAutomaticFixes(auditId: string, actor: AuthUser): Promise<ApplyFixResult> {
    const audit = await this.getAudit(auditId);
    const { pageId, layout } = await this.loadAuditPageLayout(audit);
    if (!pageId || !layout) throw new BadRequestException("Audit has no editable page draft to fix");

    const automatic = applicableFixes(this.recommendationIds(audit)).filter(
      (f) => f.category === "automatic",
    );

    // Fold automatic LAYOUT fixes onto one layout so we save the draft once.
    let working = layout;
    let applied = 0;
    const ruleIds: string[] = [];
    for (const fix of automatic) {
      if ((fix.effect ?? "layout") !== "layout") continue;
      const plan = fix.plan(working);
      if (plan.changes.length === 0) continue;
      working = plan.layout;
      applied += plan.changes.length;
      ruleIds.push(fix.ruleId);
    }
    if (working !== layout) {
      await this.pages.saveDraft(pageId, { layout: working as unknown as Record<string, unknown> }, actor);
    }

    // Run automatic MEDIA-OPTIMIZE fixes (queue background re-encoding).
    let queued = 0;
    for (const fix of automatic) {
      if ((fix.effect ?? "layout") !== "media-optimize") continue;
      const plan = fix.plan(layout);
      if (plan.changes.length === 0) continue;
      queued += await this.queueMediaOptimize(plan.changes);
      ruleIds.push(fix.ruleId);
    }

    if (applied > 0 || queued > 0) {
      await this.audit.record({
        siteId: this.repo.siteId,
        actorId: actor.userId,
        action: "page_audit.fix_applied_all",
        category: "monitoring",
        entityType: "page_audit",
        entityId: auditId,
        metadata: { pageId, ruleIds, applied, queued },
      });
    }

    return { applied, queued, pageId, ruleIds };
  }

  /** Persist a single fix plan according to its effect (layout vs media). */
  private async persistPlan(
    fix: AutoFix,
    plan: { changes: FixChange[]; layout: SerializedLayout },
    pageId: string,
    actor: AuthUser,
  ): Promise<{ applied: number; queued: number }> {
    if ((fix.effect ?? "layout") === "media-optimize") {
      return { applied: 0, queued: await this.queueMediaOptimize(plan.changes) };
    }
    // Reuse the page draft-save workflow (validates + audits, publish-safe).
    await this.pages.saveDraft(pageId, { layout: plan.layout as unknown as Record<string, unknown> }, actor);
    return { applied: plan.changes.length, queued: 0 };
  }

  /**
   * Queue image optimization for the page images named by a media-optimize fix.
   * Resolves each planned image url back to its site-scoped `media` row and
   * enqueues the EXISTING image-processing job (WebP + responsive variants).
   * External images (not in the media library) are silently skipped.
   */
  private async queueMediaOptimize(changes: FixChange[]): Promise<number> {
    const urls = [...new Set(changes.map((c) => String(c.after)).filter(Boolean))];
    if (urls.length === 0) return 0;

    const rows = await this.repo.db
      .select({ id: media.id, storageKey: media.storageKey, type: media.type })
      .from(media)
      .where(this.repo.scope(media, inArray(media.url, urls)));

    let queued = 0;
    for (const row of rows) {
      if (!row.type.startsWith("image/")) continue;
      try {
        await this.repo.db
          .update(media)
          .set({ status: "processing" })
          .where(this.repo.scope(media, eq(media.id, row.id)));
        await this.queue.enqueueMediaProcess({
          siteId: this.repo.siteId,
          mediaId: row.id,
          storageKey: row.storageKey,
        });
        queued++;
      } catch (err) {
        // Enqueue failed — mark terminal so the row cannot stay stuck in processing.
        const message = `queue error: ${((err as Error).message || String(err)).slice(0, 450)}`;
        await this.repo.db
          .update(media)
          .set({ status: "failed" })
          .where(this.repo.scope(media, eq(media.id, row.id)));
        console.warn(`[monitoring] media enqueue failed ${row.id}: ${message}`);
      }
    }
    return queued;
  }

  // --- SITE-HEALTH broken-link checker --------------------------------------

  /**
   * Resolve the site's public base URL (origin) + the Host header to carry.
   * Prefers primary/custom domain (https), else PLATFORM_BASE_DOMAIN, else the
   * local audit/renderer origin (AUDIT_BASE_URL → RENDERER_BASE_URL →
   * RENDERER_INTERNAL_URL → http://localhost:3000). For loopback origins, rewrite
   * the hostname to `<subdomain>.localhost` so Chrome navigates the tenant host
   * without a Host-header override.
   */
  private resolveSiteBase(site: SiteRow): { baseUrl: string; hostHeader: string } {
    const domain = site.primaryDomain || site.customDomain;
    if (domain) return { baseUrl: `https://${domain}`, hostHeader: domain };

    const baseDomain = process.env.PLATFORM_BASE_DOMAIN;
    if (baseDomain) {
      const host = `${site.subdomain}.${baseDomain}`;
      return { baseUrl: `https://${host}`, hostHeader: host };
    }

    const renderer = this.auditBaseFromEnv();
    const host = `${site.subdomain}.localhost`;
    // Lighthouse/Chrome reject loopback URL + extraHeaders.Host (interstitial).
    // Put the tenant hostname in the audit URL so navigation matches curl/browsers.
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
    return { baseUrl, hostHeader: host };
  }

  /**
   * Enqueue a broken-link crawl run (SITE-HEALTH). Inserts a `running`
   * `link_checks` row and enqueues a `link-check` job with the resolved site
   * base + host. The worker crawls the published pages and records broken links.
   */
  async runLinkCheck(actor: AuthUser): Promise<LinkCheckRow> {
    const [site] = await this.db
      .select()
      .from(sites)
      .where(eq(sites.id, this.repo.siteId))
      .limit(1);
    if (!site) throw new NotFoundException("Site not found");

    const { baseUrl, hostHeader } = this.resolveSiteBase(site);

    const [row] = await this.repo.db
      .insert(linkChecks)
      .values({
        ...this.repo.insertDefaults(),
        status: "running",
        pagesCrawled: 0,
        linksChecked: 0,
        brokenCount: 0,
        startedAt: new Date(),
      })
      .returning();

    const jobId = await this.queue.enqueueLinkCheck({
      runId: row.id,
      siteId: this.repo.siteId,
      baseUrl,
      hostHeader,
    });

    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "link_check.run",
      category: "monitoring",
      entityType: "link_check",
      entityId: row.id,
      metadata: { baseUrl, jobId },
    });
    return row;
  }

  /**
   * The latest link-check run for this site + its broken links (a summary read).
   * Returns `run: null` when no crawl has ever been triggered.
   *
   * While a new run is still `running`/`pending`, broken rows from the most recent
   * completed run are returned so the UI does not flash empty on "Run check" /
   * refresh mid-crawl.
   */
  async getLatestLinkCheck(q: LinksQueryDto): Promise<{
    run: LinkCheckRow | null;
    broken: BrokenLinkRow[];
    limit: number;
    offset: number;
  }> {
    const limit = q.limit ?? 100;
    const offset = q.offset ?? 0;

    const [run] = await this.repo.db
      .select()
      .from(linkChecks)
      .where(this.repo.scope(linkChecks))
      .orderBy(desc(linkChecks.startedAt))
      .limit(1);

    if (!run) return { run: null, broken: [], limit, offset };

    let brokenRunId = run.id;
    if (run.status === "running" || run.status === "pending") {
      const [prevCompleted] = await this.repo.db
        .select({ id: linkChecks.id })
        .from(linkChecks)
        .where(this.repo.scope(linkChecks, eq(linkChecks.status, "completed")))
        .orderBy(desc(linkChecks.startedAt))
        .limit(1);
      if (prevCompleted) brokenRunId = prevCompleted.id;
    }

    const broken = await this.repo.db
      .select()
      .from(brokenLinks)
      .where(this.repo.scope(brokenLinks, eq(brokenLinks.runId, brokenRunId)))
      .orderBy(desc(brokenLinks.checkedAt))
      .limit(limit)
      .offset(offset);

    return { run, broken, limit, offset };
  }

  /** Canonical public path for audits (leading slash, no trailing slash except `/`). */
  private normalizeAuditPath(path: string): string {
    const trimmed = path.trim();
    if (!trimmed || trimmed === "/") return "/";
    const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withSlash.replace(/\/+$/, "") || "/";
  }

  /** Parse an optional ISO date for audit list filters; reject invalid values. */
  private parseAuditDate(value: string | undefined, label: string): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`Invalid \`${label}\` date — use an ISO-8601 timestamp`);
    }
    return d;
  }

  /** Mark a row failed when Redis enqueue fails so it cannot block scans forever. */
  private async markAuditEnqueueFailed(auditId: string, err: unknown): Promise<void> {
    const message = `queue error: ${((err as Error).message || String(err)).slice(0, 450)}`;
    await this.repo.db
      .update(pageAudits)
      .set({ status: "failed", detail: message, ranAt: new Date() })
      .where(this.repo.scope(pageAudits, eq(pageAudits.id, auditId)));
  }
}

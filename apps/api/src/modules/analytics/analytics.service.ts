import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { analyticsDaily, analyticsEvents } from "@database/schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import { AttributionService } from "@modules/attribution/attribution.service";
import type { CollectDto, CollectEventDto } from "./dto/analytics.dto";

/** Acquisition channel derived from referrer/UTM. */
type Source = "direct" | "organic" | "referral" | "social" | "campaign";
type Device = "desktop" | "mobile" | "tablet";

const SOCIAL_HOSTS = [
  "facebook.",
  "instagram.",
  "twitter.",
  "t.co",
  "x.com",
  "linkedin.",
  "lnkd.in",
  "pinterest.",
  "reddit.",
  "youtube.",
  "tiktok.",
  "threads.",
];
const SEARCH_HOSTS = ["google.", "bing.", "yahoo.", "duckduckgo.", "yandex.", "baidu.", "ecosia."];

export interface OverviewStats {
  visitors: number;
  pageviews: number;
  avgSessionSec: number;
  bounceRate: number;
  prev: { visitors: number; pageviews: number };
}
export interface TimeseriesPoint {
  date: string;
  visitors: number;
  pageviews: number;
}
export interface PageStat {
  path: string;
  pageviews: number;
  visitors: number;
}
export interface SourceStat {
  source: string;
  visitors: number;
}
export interface DeviceStat {
  device: Device;
  visitors: number;
}
export interface VitalBucket {
  p75: number;
  good: number;
  ni: number;
  poor: number;
}
export interface WebVitalsStats {
  lcp: VitalBucket;
  cls: VitalBucket;
  inp: VitalBucket;
}

const DAY_MS = 86_400_000;

/**
 * Analytics service (Phase 2a). Two surfaces:
 *   - the @Public host-resolved ingest (`/api/collect`) → bulk-inserts raw
 *     `analytics_events` (site resolved from the Host header, no TenantContext),
 *   - the site-scoped stats reads → served from `analytics_daily` (fast, rolled
 *     up hourly by the worker), except web-vitals which queries raw events for
 *     percentiles. All reads go through ScopedRepository so no cross-tenant leak.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repo: ScopedRepository,
    private readonly resolver: SiteResolver,
    private readonly attribution: AttributionService,
  ) {}

  // --- Ingest (@Public, host-resolved) --------------------------------------

  /**
   * Ingest a beacon batch. Resolves the site from the request Host and bulk-
   * inserts raw events. Unknown host → silently dropped (0 accepted) so a bad
   * host never errors clients. NO PII / no IP is ever stored.
   */
  async collect(host: string | undefined, dto: CollectDto): Promise<{ accepted: number }> {
    const site = await this.resolver.resolve(host);
    if (!site) return { accepted: 0 };

    const events = (dto.events ?? []).slice(0, 50);
    if (events.length === 0) return { accepted: 0 };

    const now = new Date();
    const rows = events.map((e) => this.toRow(site.id, e, now));
    await this.db.insert(analyticsEvents).values(rows);

    // PHASE-5: a named "conversion" event (with an optional revenue value/label)
    // also records a durable attribution_conversions row for the attribution
    // rollup. Best-effort — a failure here never fails the beacon ingest.
    for (const e of events) {
      if (e.type === "event" && e.name === "conversion") {
        void this.attribution
          .recordConversionForSite(site.id, {
            visitorId: e.visitorId,
            value: typeof e.value === "number" ? e.value : 0,
            label: e.label,
            type: "conversion",
            path: this.normalizePath(e.path),
          })
          .catch(() => {
            /* attribution recording is best-effort */
          });
      }
    }
    return { accepted: rows.length };
  }

  private toRow(siteId: string, e: CollectEventDto, ts: Date): typeof analyticsEvents.$inferInsert {
    const source = this.deriveSource(e.referrer, e.utm);
    const device = this.normalizeDevice(e.deviceType);
    return {
      siteId,
      ts,
      type: e.type,
      path: this.normalizePath(e.path),
      referrer: e.referrer?.slice(0, 1000) ?? null,
      source,
      medium: e.utm?.medium?.slice(0, 120) ?? null,
      campaign: e.utm?.campaign?.slice(0, 200) ?? null,
      visitorId: e.visitorId,
      sessionId: e.sessionId,
      deviceType: device,
      metric: e.type === "web-vitals" ? (e.metric ?? null) : null,
      value: e.type === "web-vitals" && typeof e.value === "number" ? e.value : null,
      name: e.name?.slice(0, 120) ?? null,
      experimentId: e.experimentId?.slice(0, 50) ?? null,
      variant: e.variant?.slice(0, 20) ?? null,
    };
  }

  /** Strip query/hash and cap length; keep a leading slash. */
  private normalizePath(path: string): string {
    let p = (path || "/").split("?")[0].split("#")[0];
    if (!p.startsWith("/")) p = `/${p}`;
    return p.slice(0, 1000) || "/";
  }

  private normalizeDevice(d: string | undefined): Device {
    return d === "mobile" || d === "tablet" ? d : "desktop";
  }

  /**
   * Derive the acquisition channel. UTM wins (campaign), then referrer host
   * classification (social/organic/referral), else direct.
   */
  private deriveSource(referrer: string | undefined, utm?: { source?: string; medium?: string }): Source {
    if (utm && (utm.source || utm.medium)) return "campaign";
    if (!referrer) return "direct";
    let hostname = "";
    try {
      hostname = new URL(referrer).hostname.toLowerCase();
    } catch {
      return "direct";
    }
    if (!hostname) return "direct";
    if (SOCIAL_HOSTS.some((h) => hostname.includes(h))) return "social";
    if (SEARCH_HOSTS.some((h) => hostname.startsWith(h) || hostname.includes(`.${h}`) || hostname.includes(h)))
      return "organic";
    return "referral";
  }

  // --- Range helpers --------------------------------------------------------

  /** Resolve from/to (YYYY-MM-DD) with a 28-day default window (inclusive). */
  private resolveRange(from?: string, to?: string): { from: string; to: string } {
    const toDay = this.isDay(to) ? to! : this.dayString(new Date());
    const fromDay = this.isDay(from)
      ? from!
      : this.dayString(new Date(Date.parse(`${toDay}T00:00:00Z`) - 27 * DAY_MS));
    return fromDay <= toDay ? { from: fromDay, to: toDay } : { from: toDay, to: fromDay };
  }

  private isDay(v: string | undefined): boolean {
    return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  }
  private dayString(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** The immediately-preceding window of equal length (for prev deltas). */
  private prevRange(from: string, to: string): { from: string; to: string } {
    const fromMs = Date.parse(`${from}T00:00:00Z`);
    const toMs = Date.parse(`${to}T00:00:00Z`);
    const days = Math.round((toMs - fromMs) / DAY_MS) + 1;
    const prevTo = this.dayString(new Date(fromMs - DAY_MS));
    const prevFrom = this.dayString(new Date(fromMs - days * DAY_MS));
    return { from: prevFrom, to: prevTo };
  }

  // --- Stats reads (from analytics_daily) -----------------------------------

  async overview(from?: string, to?: string): Promise<OverviewStats> {
    const range = this.resolveRange(from, to);
    const prev = this.prevRange(range.from, range.to);
    const [cur, prv] = await Promise.all([
      this.aggregateRange(range.from, range.to),
      this.aggregateRange(prev.from, prev.to),
    ]);
    const avgSessionSec = cur.sessions > 0 ? Math.round(cur.sessionSeconds / cur.sessions) : 0;
    const bounceRate = cur.sessions > 0 ? cur.bouncedSessions / cur.sessions : 0;
    return {
      visitors: cur.visitors,
      pageviews: cur.pageviews,
      avgSessionSec,
      bounceRate: Math.min(1, Math.max(0, Number(bounceRate.toFixed(4)))),
      prev: { visitors: prv.visitors, pageviews: prv.pageviews },
    };
  }

  /**
   * Sum daily rows across a range. Visitors/sessions are summed per-day counts
   * (a returning visitor is counted per-day — the standard "daily uniques" model
   * for a fast pre-aggregated store).
   */
  private async aggregateRange(from: string, to: string): Promise<{
    visitors: number;
    pageviews: number;
    sessions: number;
    sessionSeconds: number;
    bouncedSessions: number;
  }> {
    const [row] = await this.repo.db
      .select({
        visitors: sql<number>`coalesce(sum(${analyticsDaily.visitors}), 0)`,
        pageviews: sql<number>`coalesce(sum(${analyticsDaily.pageviews}), 0)`,
        sessions: sql<number>`coalesce(sum(${analyticsDaily.sessions}), 0)`,
        sessionSeconds: sql<number>`coalesce(sum(${analyticsDaily.sessionSeconds}), 0)`,
        bouncedSessions: sql<number>`coalesce(sum(${analyticsDaily.bouncedSessions}), 0)`,
      })
      .from(analyticsDaily)
      .where(this.repo.scope(analyticsDaily, this.dayBetween(from, to)));
    return {
      visitors: Number(row?.visitors ?? 0),
      pageviews: Number(row?.pageviews ?? 0),
      sessions: Number(row?.sessions ?? 0),
      sessionSeconds: Number(row?.sessionSeconds ?? 0),
      bouncedSessions: Number(row?.bouncedSessions ?? 0),
    };
  }

  private dayBetween(from: string, to: string) {
    return and(gte(analyticsDaily.day, from), lte(analyticsDaily.day, to));
  }

  async timeseries(from?: string, to?: string): Promise<TimeseriesPoint[]> {
    const range = this.resolveRange(from, to);
    const rows = await this.repo.db
      .select({
        date: analyticsDaily.day,
        visitors: sql<number>`coalesce(sum(${analyticsDaily.visitors}), 0)`,
        pageviews: sql<number>`coalesce(sum(${analyticsDaily.pageviews}), 0)`,
      })
      .from(analyticsDaily)
      .where(this.repo.scope(analyticsDaily, this.dayBetween(range.from, range.to)))
      .groupBy(analyticsDaily.day);

    const byDay = new Map<string, { visitors: number; pageviews: number }>();
    for (const r of rows) {
      byDay.set(r.date, { visitors: Number(r.visitors), pageviews: Number(r.pageviews) });
    }
    // Dense series: fill every day in the range (zeros where no data).
    const out: TimeseriesPoint[] = [];
    let cursor = Date.parse(`${range.from}T00:00:00Z`);
    const end = Date.parse(`${range.to}T00:00:00Z`);
    while (cursor <= end) {
      const date = this.dayString(new Date(cursor));
      const hit = byDay.get(date);
      out.push({ date, visitors: hit?.visitors ?? 0, pageviews: hit?.pageviews ?? 0 });
      cursor += DAY_MS;
    }
    return out;
  }

  async pages(from?: string, to?: string, limit = 20): Promise<PageStat[]> {
    const range = this.resolveRange(from, to);
    const rows = await this.repo.db
      .select({
        path: analyticsDaily.path,
        pageviews: sql<number>`coalesce(sum(${analyticsDaily.pageviews}), 0)`,
        visitors: sql<number>`coalesce(sum(${analyticsDaily.visitors}), 0)`,
      })
      .from(analyticsDaily)
      .where(this.repo.scope(analyticsDaily, this.dayBetween(range.from, range.to)))
      .groupBy(analyticsDaily.path)
      .orderBy(sql`coalesce(sum(${analyticsDaily.pageviews}), 0) desc`)
      .limit(limit);
    return rows.map((r) => ({
      path: r.path,
      pageviews: Number(r.pageviews),
      visitors: Number(r.visitors),
    }));
  }

  async sources(from?: string, to?: string): Promise<SourceStat[]> {
    const range = this.resolveRange(from, to);
    const rows = await this.repo.db
      .select({ sources: analyticsDaily.sources })
      .from(analyticsDaily)
      .where(this.repo.scope(analyticsDaily, this.dayBetween(range.from, range.to)));
    return this.sumMap(rows.map((r) => r.sources)).map(([source, visitors]) => ({ source, visitors }));
  }

  async devices(from?: string, to?: string): Promise<DeviceStat[]> {
    const range = this.resolveRange(from, to);
    const rows = await this.repo.db
      .select({ devices: analyticsDaily.devices })
      .from(analyticsDaily)
      .where(this.repo.scope(analyticsDaily, this.dayBetween(range.from, range.to)));
    const valid = new Set<Device>(["desktop", "mobile", "tablet"]);
    return this.sumMap(rows.map((r) => r.devices))
      .filter(([k]) => valid.has(k as Device))
      .map(([device, visitors]) => ({ device: device as Device, visitors }));
  }

  /** Sum a list of {key:count} jsonb maps → sorted [key, total] pairs (desc). */
  private sumMap(maps: Array<Record<string, number> | null | undefined>): Array<[string, number]> {
    const acc = new Map<string, number>();
    for (const m of maps) {
      if (!m) continue;
      for (const [k, v] of Object.entries(m)) {
        acc.set(k, (acc.get(k) ?? 0) + (Number(v) || 0));
      }
    }
    return [...acc.entries()].sort((a, b) => b[1] - a[1]);
  }

  // --- Web-vitals (raw events, percentiles) ---------------------------------

  async webVitals(from?: string, to?: string): Promise<WebVitalsStats> {
    const range = this.resolveRange(from, to);
    const fromTs = new Date(`${range.from}T00:00:00.000Z`);
    const toTs = new Date(`${range.to}T23:59:59.999Z`);

    const [lcp, cls, inp] = await Promise.all([
      this.metricValues("LCP", fromTs, toTs),
      this.metricValues("CLS", fromTs, toTs),
      this.metricValues("INP", fromTs, toTs),
    ]);
    return {
      lcp: this.bucketize(lcp, 2500, 4000),
      cls: this.bucketize(cls, 0.1, 0.25),
      inp: this.bucketize(inp, 200, 500),
    };
  }

  private async metricValues(metric: string, fromTs: Date, toTs: Date): Promise<number[]> {
    const rows = await this.repo.db
      .select({ value: analyticsEvents.value })
      .from(analyticsEvents)
      .where(
        this.repo.scope(
          analyticsEvents,
          eq(analyticsEvents.type, "web-vitals"),
          eq(analyticsEvents.metric, metric),
          gte(analyticsEvents.ts, fromTs),
          lte(analyticsEvents.ts, toTs),
        ),
      );
    return rows
      .map((r) => (typeof r.value === "number" ? r.value : null))
      .filter((v): v is number => v !== null);
  }

  /**
   * Compute p75 + WCAG-style good/needs-improvement/poor bucket counts for a
   * metric given its "good" and "poor" thresholds. Empty → all zeros.
   */
  private bucketize(values: number[], goodThreshold: number, poorThreshold: number): VitalBucket {
    if (values.length === 0) return { p75: 0, good: 0, ni: 0, poor: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.ceil(0.75 * sorted.length) - 1);
    const p75 = sorted[Math.max(0, idx)];
    let good = 0;
    let ni = 0;
    let poor = 0;
    for (const v of values) {
      if (v <= goodThreshold) good++;
      else if (v <= poorThreshold) ni++;
      else poor++;
    }
    return { p75: Number(p75.toFixed(3)), good, ni, poor };
  }
}

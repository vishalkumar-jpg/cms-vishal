import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { analyticsEvents, attributionConversions } from "@database/schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import type { AttributionModel } from "./dto/attribution.dto";

/** A single session-level touchpoint for a visitor (derived from analytics_events). */
interface Touchpoint {
  source: string;
  medium: string | null;
  campaign: string | null;
  landingPath: string;
  ts: number;
}

/** A conversion with its ordered touchpoints (the visitor's pre-conversion journey). */
interface Journey {
  value: number;
  touchpoints: Touchpoint[];
}

/** A credited dimension row (source / campaign / landing page). */
export interface AttributionBreakdownRow {
  key: string;
  conversions: number;
  value: number;
}

export interface AttributionOverview {
  model: AttributionModel;
  from: string;
  to: string;
  totals: { conversions: number; value: number; touchpoints: number };
  bySource: AttributionBreakdownRow[];
  byCampaign: AttributionBreakdownRow[];
  byLandingPage: AttributionBreakdownRow[];
}

export interface RecentConversion {
  id: string;
  ts: string;
  visitorId: string;
  type: string;
  label: string | null;
  value: number;
  landingPath: string | null;
}

const DAY_MS = 86_400_000;

/**
 * Attribution service (Phase 5). Computes marketing attribution ON READ:
 *   1. loads the site's `attribution_conversions` in the window,
 *   2. reconstructs each visitor's TOUCHPOINTS from `analytics_events` (one per
 *      session: its source/medium/campaign/landing-path, ordered by time),
 *   3. credits each conversion's `value` + 1 conversion across the touchpoints
 *      that PRECEDE it under the chosen model (first/last/linear/position),
 *   4. rolls the credit up by source / campaign / landing-page.
 * All reads go through ScopedRepository — no cross-tenant leak. A `@Public`
 * host-resolved beacon (`/api/collect` value/label) writes the conversions;
 * see AttributionController + the analytics collect extension.
 */
@Injectable()
export class AttributionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repo: ScopedRepository,
    private readonly resolver: SiteResolver,
  ) {}

  // --- Public ingest (host-resolved) ----------------------------------------

  /**
   * Record a conversion beacon (host-resolved, no TenantContext). Called by the
   * @Public attribution controller (mirrors /collect). Silently no-ops for an
   * unknown host so a bad Host never errors the client.
   */
  async recordConversion(
    host: string | undefined,
    body: { visitorId: string; value?: number; label?: string; type?: string; path?: string },
  ): Promise<{ recorded: boolean }> {
    const site = await this.resolver.resolve(host);
    if (!site || !body.visitorId) return { recorded: false };
    await this.db.insert(attributionConversions).values({
      siteId: site.id,
      visitorId: body.visitorId,
      type: (body.type ?? "conversion").slice(0, 40),
      label: body.label?.slice(0, 200) ?? null,
      value: Number.isFinite(body.value) ? Number(body.value) : 0,
      landingPath: body.path?.slice(0, 1000) ?? null,
    });
    return { recorded: true };
  }

  /**
   * Site-scoped conversion record (from an authenticated context or an internal
   * caller that already resolved the site — used by tests + the goal path).
   */
  async recordConversionForSite(
    siteId: string,
    body: { visitorId: string; value?: number; label?: string; type?: string; path?: string },
  ): Promise<void> {
    if (!body.visitorId) return;
    await this.db.insert(attributionConversions).values({
      siteId,
      visitorId: body.visitorId,
      type: (body.type ?? "conversion").slice(0, 40),
      label: body.label?.slice(0, 200) ?? null,
      value: Number.isFinite(body.value) ? Number(body.value) : 0,
      landingPath: body.path?.slice(0, 1000) ?? null,
    });
  }

  // --- Reads (site-scoped) --------------------------------------------------

  async overview(from?: string, to?: string, model: AttributionModel = "last"): Promise<AttributionOverview> {
    const { start, end, fromStr, toStr } = this.resolveRange(from, to);
    const journeys = await this.buildJourneys(start, end);

    const bySource = new Map<string, AttributionBreakdownRow>();
    const byCampaign = new Map<string, AttributionBreakdownRow>();
    const byLanding = new Map<string, AttributionBreakdownRow>();
    let totalConversions = 0;
    let totalValue = 0;
    let totalTouchpoints = 0;

    for (const j of journeys) {
      totalConversions += 1;
      totalValue += j.value;
      totalTouchpoints += j.touchpoints.length;
      const credits = this.credit(j, model);
      for (const c of credits) {
        this.addCredit(bySource, c.tp.source || "direct", c.convShare, c.valueShare);
        this.addCredit(byCampaign, c.tp.campaign || "(none)", c.convShare, c.valueShare);
        this.addCredit(byLanding, c.tp.landingPath || "/", c.convShare, c.valueShare);
      }
    }

    return {
      model,
      from: fromStr,
      to: toStr,
      totals: {
        conversions: totalConversions,
        value: round(totalValue),
        touchpoints: totalTouchpoints,
      },
      bySource: sortRows(bySource),
      byCampaign: sortRows(byCampaign),
      byLandingPage: sortRows(byLanding),
    };
  }

  /** Compare first/last/linear side-by-side (by-source credit under each). */
  async models(from?: string, to?: string): Promise<{
    from: string;
    to: string;
    models: Array<{ model: AttributionModel; bySource: AttributionBreakdownRow[]; totalValue: number }>;
  }> {
    const { start, end, fromStr, toStr } = this.resolveRange(from, to);
    const journeys = await this.buildJourneys(start, end);
    const models: AttributionModel[] = ["first", "last", "linear"];
    return {
      from: fromStr,
      to: toStr,
      models: models.map((model) => {
        const bySource = new Map<string, AttributionBreakdownRow>();
        let totalValue = 0;
        for (const j of journeys) {
          totalValue += j.value;
          for (const c of this.credit(j, model)) {
            this.addCredit(bySource, c.tp.source || "direct", c.convShare, c.valueShare);
          }
        }
        return { model, bySource: sortRows(bySource), totalValue: round(totalValue) };
      }),
    };
  }

  async recent(from?: string, to?: string, limit = 50): Promise<RecentConversion[]> {
    const { start, end } = this.resolveRange(from, to);
    const rows = await this.repo.db
      .select()
      .from(attributionConversions)
      .where(
        this.repo.scope(
          attributionConversions,
          and(gte(attributionConversions.ts, start), lte(attributionConversions.ts, end)),
        ),
      )
      .orderBy(desc(attributionConversions.ts))
      .limit(Math.min(limit, 200));
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts.toISOString(),
      visitorId: r.visitorId,
      type: r.type,
      label: r.label,
      value: r.value,
      landingPath: r.landingPath,
    }));
  }

  // --- Internals ------------------------------------------------------------

  /**
   * Reconstruct visitor journeys for the window: each conversion joined to its
   * visitor's session touchpoints (from analytics_events) that PRECEDE it.
   */
  private async buildJourneys(start: Date, end: Date): Promise<Journey[]> {
    const conversions = await this.repo.db
      .select()
      .from(attributionConversions)
      .where(
        this.repo.scope(
          attributionConversions,
          and(gte(attributionConversions.ts, start), lte(attributionConversions.ts, end)),
        ),
      );
    if (conversions.length === 0) return [];

    const visitorIds = [...new Set(conversions.map((c) => c.visitorId))];

    // One touchpoint per (visitor, session): the session's first pageview
    // carries the acquisition channel + landing path. Look back before the
    // window start so a conversion can be credited to an earlier touch.
    const lookback = new Date(start.getTime() - 90 * DAY_MS);
    const tpRows = await this.repo.db
      .select({
        visitorId: analyticsEvents.visitorId,
        sessionId: analyticsEvents.sessionId,
        source: sql<string>`(array_agg(${analyticsEvents.source} order by ${analyticsEvents.ts} asc))[1]`,
        medium: sql<string | null>`(array_agg(${analyticsEvents.medium} order by ${analyticsEvents.ts} asc))[1]`,
        campaign: sql<string | null>`(array_agg(${analyticsEvents.campaign} order by ${analyticsEvents.ts} asc))[1]`,
        landingPath: sql<string>`(array_agg(${analyticsEvents.path} order by ${analyticsEvents.ts} asc))[1]`,
        ts: sql<Date>`min(${analyticsEvents.ts})`,
      })
      .from(analyticsEvents)
      .where(
        this.repo.scope(
          analyticsEvents,
          and(
            eq(analyticsEvents.type, "pageview"),
            gte(analyticsEvents.ts, lookback),
            lte(analyticsEvents.ts, end),
            inArray(analyticsEvents.visitorId, visitorIds),
          ),
        ),
      )
      .groupBy(analyticsEvents.visitorId, analyticsEvents.sessionId);

    const byVisitor = new Map<string, Touchpoint[]>();
    for (const r of tpRows) {
      const list = byVisitor.get(r.visitorId) ?? [];
      list.push({
        source: r.source ?? "direct",
        medium: r.medium ?? null,
        campaign: r.campaign ?? null,
        landingPath: r.landingPath ?? "/",
        ts: new Date(r.ts).getTime(),
      });
      byVisitor.set(r.visitorId, list);
    }
    for (const list of byVisitor.values()) list.sort((a, b) => a.ts - b.ts);

    return conversions.map((c) => {
      const all = byVisitor.get(c.visitorId) ?? [];
      const convTs = c.ts.getTime();
      let pre = all.filter((tp) => tp.ts <= convTs);
      // Fall back: if no pre-conversion touchpoint, credit a synthetic "direct"
      // touch on the conversion's own landing path so the conversion is counted.
      if (pre.length === 0) {
        pre = [
          {
            source: "direct",
            medium: null,
            campaign: null,
            landingPath: c.landingPath ?? "/",
            ts: convTs,
          },
        ];
      }
      return { value: c.value, touchpoints: pre };
    });
  }

  /**
   * Credit a journey's conversion (1) + value across its touchpoints under the
   * model. Returns per-touchpoint shares (they sum to 1 conversion + full value).
   */
  private credit(
    j: Journey,
    model: AttributionModel,
  ): Array<{ tp: Touchpoint; convShare: number; valueShare: number }> {
    const tps = j.touchpoints;
    const n = tps.length;
    if (n === 0) return [];
    const weights = new Array<number>(n).fill(0);

    if (model === "first") {
      weights[0] = 1;
    } else if (model === "last") {
      weights[n - 1] = 1;
    } else if (model === "linear") {
      weights.fill(1 / n);
    } else {
      // position-based / U-shaped: 40% first, 40% last, 20% split among middle.
      if (n === 1) {
        weights[0] = 1;
      } else if (n === 2) {
        weights[0] = 0.5;
        weights[1] = 0.5;
      } else {
        weights[0] = 0.4;
        weights[n - 1] = 0.4;
        const mid = 0.2 / (n - 2);
        for (let i = 1; i < n - 1; i++) weights[i] = mid;
      }
    }

    return tps.map((tp, i) => ({
      tp,
      convShare: weights[i],
      valueShare: j.value * weights[i],
    }));
  }

  private addCredit(
    map: Map<string, AttributionBreakdownRow>,
    key: string,
    conv: number,
    value: number,
  ): void {
    const row = map.get(key) ?? { key, conversions: 0, value: 0 };
    row.conversions += conv;
    row.value += value;
    map.set(key, row);
  }

  private resolveRange(
    from?: string,
    to?: string,
  ): { start: Date; end: Date; fromStr: string; toStr: string } {
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(end.getTime() - 27 * DAY_MS);
    return {
      start,
      end,
      fromStr: from ?? start.toISOString().slice(0, 10),
      toStr: to ?? end.toISOString().slice(0, 10),
    };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function sortRows(map: Map<string, AttributionBreakdownRow>): AttributionBreakdownRow[] {
  return [...map.values()]
    .map((r) => ({ key: r.key, conversions: round(r.conversions), value: round(r.value) }))
    .sort((a, b) => b.value - a.value || b.conversions - a.conversions)
    .slice(0, 50);
}

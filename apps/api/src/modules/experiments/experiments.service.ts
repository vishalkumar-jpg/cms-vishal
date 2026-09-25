import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  analyticsEvents,
  audienceMemberships,
  audienceDefinitions,
  experiments,
  experimentVariants,
  type ExperimentRow,
  type ExperimentVariantRow,
} from "@database/schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { SiteResolver } from "@modules/seo/site-resolver.service";
import type { ExperimentDto, ExperimentStatusDto } from "./dto/experiments.dto";

export interface ExperimentWithVariants extends ExperimentRow {
  variants: ExperimentVariantRow[];
}

export interface VariantResult {
  variantId: string;
  key: string;
  name: string;
  isControl: boolean;
  exposures: number;
  conversions: number;
  rate: number;
  /** Relative uplift vs the control variant's rate (fraction; null for control). */
  uplift: number | null;
  /** Two-proportion z-test confidence vs control that this variant differs (0..1). */
  confidence: number | null;
}

export interface ExperimentResults {
  experimentId: string;
  status: string;
  goalType: string;
  totalExposures: number;
  totalConversions: number;
  variants: VariantResult[];
  /** The leading (non-control) variant id by rate, if any exposures. */
  leaderVariantId: string | null;
}

/** Public (host-resolved) experiment shape consumed by the renderer Experiment block. */
export interface PublicExperiment {
  id: string;
  status: string;
  goalType: string;
  goalPath: string | null;
  variants: Array<{ key: string; weight: number; isControl: boolean }>;
}

/**
 * Experiments service (Phase 4). CRUD over `experiments` + their weighted
 * `experiment_variants`, lifecycle transitions (start/pause/stop), an on-read
 * results rollup (exposures/conversions from `analytics_events`, a two-proportion
 * z-test vs control), and a `@Public` host-resolved read for the renderer block.
 * All tenant reads/writes are ScopedRepository-guarded (site-isolated).
 */
@Injectable()
export class ExperimentsService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly resolver: SiteResolver,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  // --- CRUD -----------------------------------------------------------------

  async list(): Promise<ExperimentWithVariants[]> {
    const defs = await this.repo.db
      .select()
      .from(experiments)
      .where(this.repo.scope(experiments))
      .orderBy(desc(experiments.createdAt));
    if (defs.length === 0) return [];
    const vars = await this.repo.db
      .select()
      .from(experimentVariants)
      .where(this.repo.scope(experimentVariants))
      .orderBy(asc(experimentVariants.key));
    const byExp = new Map<string, ExperimentVariantRow[]>();
    for (const v of vars) {
      const arr = byExp.get(v.experimentId) ?? [];
      arr.push(v);
      byExp.set(v.experimentId, arr);
    }
    return defs.map((d) => ({ ...d, variants: byExp.get(d.id) ?? [] }));
  }

  async get(id: string): Promise<ExperimentWithVariants> {
    const [row] = await this.repo.db
      .select()
      .from(experiments)
      .where(this.repo.scope(experiments, eq(experiments.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Experiment not found");
    const variants = await this.repo.db
      .select()
      .from(experimentVariants)
      .where(this.repo.scope(experimentVariants, eq(experimentVariants.experimentId, id)))
      .orderBy(asc(experimentVariants.key));
    return { ...row, variants };
  }

  private assertVariants(dto: ExperimentDto): void {
    const keys = new Set<string>();
    let controls = 0;
    for (const v of dto.variants) {
      if (!v.key.trim()) throw new BadRequestException("Variant key required");
      if (keys.has(v.key)) throw new BadRequestException(`Duplicate variant key: ${v.key}`);
      keys.add(v.key);
      if (v.isControl) controls += 1;
    }
    if (controls > 1) throw new BadRequestException("Only one variant can be the control");
  }

  async create(dto: ExperimentDto, user: AuthUser): Promise<ExperimentWithVariants> {
    this.assertVariants(dto);
    const [row] = await this.repo.db
      .insert(experiments)
      .values({
        ...this.repo.insertDefaults(),
        name: dto.name,
        description: dto.description ?? null,
        pageId: dto.pageId ?? null,
        goalType: dto.goalType ?? "pageview",
        goalPath: dto.goalPath ?? null,
        status: "draft",
      })
      .returning();
    await this.replaceVariants(row.id, dto);
    await this.recordAudit(user, "experiment.created", row.id, { name: dto.name });
    return this.get(row.id);
  }

  async update(id: string, dto: ExperimentDto, user: AuthUser): Promise<ExperimentWithVariants> {
    this.assertVariants(dto);
    const [row] = await this.repo.db
      .update(experiments)
      .set({
        name: dto.name,
        description: dto.description ?? null,
        pageId: dto.pageId ?? null,
        goalType: dto.goalType ?? "pageview",
        goalPath: dto.goalPath ?? null,
        updatedBy: user.userId,
      })
      .where(this.repo.scope(experiments, eq(experiments.id, id)))
      .returning();
    if (!row) throw new NotFoundException("Experiment not found");
    await this.replaceVariants(id, dto);
    await this.recordAudit(user, "experiment.updated", id, { name: dto.name });
    return this.get(id);
  }

  /** Replace the full variant set for an experiment (delete-all-then-insert). */
  private async replaceVariants(experimentId: string, dto: ExperimentDto): Promise<void> {
    await this.repo.db
      .delete(experimentVariants)
      .where(this.repo.scope(experimentVariants, eq(experimentVariants.experimentId, experimentId)));
    await this.repo.db.insert(experimentVariants).values(
      dto.variants.map((v) => ({
        ...this.repo.insertDefaults(),
        experimentId,
        key: v.key,
        name: v.name,
        weight: v.weight != null && v.weight > 0 ? v.weight : 1,
        isControl: !!v.isControl,
      })),
    );
  }

  async remove(id: string, user: AuthUser): Promise<{ id: string }> {
    const [row] = await this.repo.db
      .update(experiments)
      .set({ deletedAt: new Date(), updatedBy: user.userId })
      .where(this.repo.scope(experiments, eq(experiments.id, id)))
      .returning({ id: experiments.id });
    if (!row) throw new NotFoundException("Experiment not found");
    // Variants are soft-deleted alongside (they're scoped by soft-delete too).
    await this.repo.db
      .update(experimentVariants)
      .set({ deletedAt: new Date(), updatedBy: user.userId })
      .where(this.repo.scope(experimentVariants, eq(experimentVariants.experimentId, id)));
    await this.recordAudit(user, "experiment.deleted", id);
    return { id: row.id };
  }

  // --- Lifecycle ------------------------------------------------------------

  async setStatus(id: string, dto: ExperimentStatusDto, user: AuthUser): Promise<ExperimentWithVariants> {
    const current = await this.get(id);
    const patch: Partial<typeof experiments.$inferInsert> = {
      status: dto.status,
      updatedBy: user.userId,
    };
    // First transition to running stamps startedAt (once).
    if (dto.status === "running" && !current.startedAt) patch.startedAt = new Date();
    if (dto.status === "done" && dto.winnerVariantId) {
      const winner = current.variants.find((v) => v.id === dto.winnerVariantId);
      if (!winner) throw new BadRequestException("Winner variant not part of this experiment");
      patch.winnerVariantId = dto.winnerVariantId;
    }
    await this.repo.db
      .update(experiments)
      .set(patch)
      .where(this.repo.scope(experiments, eq(experiments.id, id)));
    await this.recordAudit(user, "experiment.status_changed", id, { status: dto.status });
    return this.get(id);
  }

  // --- Results (on-read rollup + z-test) ------------------------------------

  async results(id: string): Promise<ExperimentResults> {
    const exp = await this.get(id);
    // Per-variant exposure + conversion counts from the analytics stream (scoped
    // to the site via ScopedRepository so no cross-tenant leak). Exposures &
    // conversions are `type="event"` rows tagged with experimentId + variant.
    const rows = await this.repo.db
      .select({
        variant: analyticsEvents.variant,
        name: analyticsEvents.name,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        this.repo.scope(
          analyticsEvents,
          and(eq(analyticsEvents.experimentId, id), eq(analyticsEvents.type, "event")),
        ),
      )
      .groupBy(analyticsEvents.variant, analyticsEvents.name);

    const exposures = new Map<string, number>();
    const conversions = new Map<string, number>();
    for (const r of rows) {
      const key = r.variant ?? "";
      if (r.name === "exposure") exposures.set(key, (exposures.get(key) ?? 0) + Number(r.count));
      else if (r.name === "conversion")
        conversions.set(key, (conversions.get(key) ?? 0) + Number(r.count));
    }

    const control = exp.variants.find((v) => v.isControl) ?? exp.variants[0];
    const controlExp = control ? (exposures.get(control.key) ?? 0) : 0;
    const controlConv = control ? (conversions.get(control.key) ?? 0) : 0;
    const controlRate = controlExp > 0 ? controlConv / controlExp : 0;

    const variants: VariantResult[] = exp.variants.map((v) => {
      const exp_ = exposures.get(v.key) ?? 0;
      const conv = conversions.get(v.key) ?? 0;
      const rate = exp_ > 0 ? conv / exp_ : 0;
      const isControl = control ? v.id === control.id : false;
      const uplift = isControl || controlRate <= 0 ? null : rate / controlRate - 1;
      const confidence =
        isControl || !control ? null : twoProportionConfidence(conv, exp_, controlConv, controlExp);
      return {
        variantId: v.id,
        key: v.key,
        name: v.name,
        isControl,
        exposures: exp_,
        conversions: conv,
        rate,
        uplift,
        confidence,
      };
    });

    // Leader = the best-rate variant among those with exposures (any variant,
    // including control — the caller can compare vs control's confidence).
    let leaderVariantId: string | null = null;
    let best = -1;
    for (const v of variants) {
      if (v.exposures > 0 && v.rate > best) {
        best = v.rate;
        leaderVariantId = v.variantId;
      }
    }

    return {
      experimentId: id,
      status: exp.status,
      goalType: exp.goalType,
      totalExposures: variants.reduce((s, v) => s + v.exposures, 0),
      totalConversions: variants.reduce((s, v) => s + v.conversions, 0),
      variants,
      leaderVariantId,
    };
  }

  // --- Public (host-resolved, no tenant context) ----------------------------

  /**
   * Host-resolved read for the renderer's Experiment block: the running/paused
   * experiment's variant keys + weights + control. Returns null (block shows
   * control) for an unknown host or a missing/soft-deleted experiment. Does NOT
   * leak names/goals — only what the client needs to assign a bucket.
   */
  async publicExperiment(host: string | undefined, id: string): Promise<PublicExperiment | null> {
    const site = await this.resolver.resolve(host);
    if (!site) return null;
    const [exp] = await this.db
      .select()
      .from(experiments)
      .where(
        and(
          eq(experiments.id, id),
          eq(experiments.siteId, site.id),
          sql`${experiments.deletedAt} is null`,
        ),
      )
      .limit(1);
    if (!exp) return null;
    const vars = await this.db
      .select()
      .from(experimentVariants)
      .where(
        and(
          eq(experimentVariants.experimentId, id),
          eq(experimentVariants.siteId, site.id),
          sql`${experimentVariants.deletedAt} is null`,
        ),
      )
      .orderBy(asc(experimentVariants.key));
    return {
      id: exp.id,
      status: exp.status,
      goalType: exp.goalType,
      goalPath: exp.goalPath,
      variants: vars.map((v) => ({ key: v.key, weight: v.weight, isControl: v.isControl })),
    };
  }

  /**
   * Resolve the audience ids a visitor belongs to (host-resolved, public). Used
   * by the renderer to evaluate `visibleIf: audience` server/client-side. Reads
   * the materialized `audience_memberships` (site-scoped) by visitorId.
   */
  async personalize(host: string | undefined, visitorId: string): Promise<{ audiences: string[] }> {
    const site = await this.resolver.resolve(host);
    if (!site || !visitorId) return { audiences: [] };
    const rows = await this.db
      .select({ audienceId: audienceMemberships.audienceId })
      .from(audienceMemberships)
      .innerJoin(audienceDefinitions, eq(audienceDefinitions.id, audienceMemberships.audienceId))
      .where(
        and(
          eq(audienceMemberships.siteId, site.id),
          eq(audienceMemberships.visitorId, visitorId),
          sql`${audienceDefinitions.deletedAt} is null`,
        ),
      );
    return { audiences: [...new Set(rows.map((r) => r.audienceId))] };
  }

  private async recordAudit(
    actor: AuthUser,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action,
      category: "content",
      entityType: "experiment",
      entityId,
      metadata,
    });
  }
}

/**
 * Two-proportion z-test → a one-sided confidence (0..1) that the variant's
 * conversion rate exceeds the control's. Uses the pooled-proportion standard
 * error and a logistic approximation of the normal CDF (no stats dependency).
 * Returns 0 when there is insufficient data. This is a simple frequentist
 * signal for the admin — not a substitute for a full sequential test.
 */
function twoProportionConfidence(
  convA: number,
  expA: number,
  convB: number,
  expB: number,
): number {
  if (expA <= 0 || expB <= 0) return 0;
  const pA = convA / expA;
  const pB = convB / expB;
  const pPool = (convA + convB) / (expA + expB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / expA + 1 / expB));
  if (se === 0) return 0;
  const z = (pA - pB) / se;
  // Φ(z) via a logistic approximation of the standard-normal CDF.
  const phi = 1 / (1 + Math.exp(-1.702 * z));
  return Math.max(0, Math.min(1, phi));
}

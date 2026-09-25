/**
 * Idempotent builtin Starter Template skeleton seed for catalog browse.
 *
 * Inserts published example skeletons (metadata + usable starter layouts).
 * Idempotency key: deterministic `templateKey` (skip if active row exists).
 *
 * @see docs/cms/template-catalog.md
 */
import { and, eq, isNull } from "drizzle-orm";
import { deserializeLayout } from "@ob-cms/block-schema";
import {
  SKELETON_CONTENT_SCHEMA_VERSION,
  parseCreateTemplateSkeletonInput,
  type CreateTemplateSkeletonInput,
} from "@ob-cms/template-registry";
import type { Database } from "@database/db";
import {
  templateSkeletonContents,
  templateSkeletons,
} from "@database/schema/template-skeletons.schema";
import { TemplateSkeletonRepository } from "@modules/template-skeletons/template-skeleton.repository";
import {
  backfillSkeletonVersionIfEmpty,
  TemplateSkeletonVersionRepository,
} from "@modules/template-skeletons/template-skeleton-version.repository";
import { STARTER_LAYOUT_BUILDERS } from "./starter-layouts";

export type BuiltinSkeletonSeedDef = {
  templateKey: string;
  displayName: string;
  description: string;
  category: CreateTemplateSkeletonInput["category"];
  supportedPageTypes: string[];
  tags: string[];
  featured?: boolean;
  sectionId: string;
  sectionLabel: string;
};

/** Deterministic published starters for `/api/template-catalog` (Starter Templates). */
export const BUILTIN_SKELETON_SEED_DEFS: readonly BuiltinSkeletonSeedDef[] = [
  {
    templateKey: "tpl-blank",
    displayName: "Blank Page",
    description: "Clean canvas with a light heading — start from scratch.",
    category: "utility",
    supportedPageTypes: ["generic-content"],
    tags: ["blank", "starter", "utility", "content"],
    sectionId: "body",
    sectionLabel: "Body",
  },
  {
    templateKey: "tpl-saas-landing",
    displayName: "SaaS Landing",
    description: "Campaign landing with hero, features, social proof, pricing, and CTA.",
    category: "campaign",
    supportedPageTypes: ["landing"],
    tags: ["saas", "landing", "campaign", "startup", "product", "marketing"],
    featured: true,
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-marketing-hero",
    displayName: "Marketing Hero",
    description: "Split hero with stats, content band, features, and a closing CTA.",
    category: "marketing",
    supportedPageTypes: ["landing"],
    tags: ["marketing", "hero", "landing", "startup", "agency", "business"],
    featured: true,
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-portfolio",
    displayName: "Portfolio",
    description: "Project gallery, testimonial, and contact CTA for creative portfolios.",
    category: "marketing",
    supportedPageTypes: ["about"],
    tags: ["portfolio", "showcase", "agency", "creative", "business"],
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-contact",
    displayName: "Contact Page",
    description: "Contact details, inquiry form, and FAQ for support pages.",
    category: "marketing",
    supportedPageTypes: ["contact"],
    tags: ["contact", "form", "lead", "business", "company", "services"],
    featured: true,
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-about",
    displayName: "About",
    description: "Company story with stats, team grid, and a closing CTA.",
    category: "marketing",
    supportedPageTypes: ["about"],
    tags: ["about", "trust", "team", "company", "business", "agency"],
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-landing",
    displayName: "Landing Page",
    description: "Lead-gen landing with inline form, logo cloud, FAQ, and CTA.",
    category: "campaign",
    supportedPageTypes: ["landing"],
    tags: ["landing", "lead-gen", "campaign", "marketing", "startup", "agency"],
    featured: true,
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-thank-you",
    displayName: "Thank You Page",
    description: "Post-submit confirmation with next steps and secondary actions.",
    category: "campaign",
    supportedPageTypes: ["thank-you"],
    tags: ["thank-you", "conversion", "post-submit", "marketing", "landing"],
    sectionId: "body",
    sectionLabel: "Body",
  },
  {
    templateKey: "tpl-404",
    displayName: "404 Page",
    description: "Friendly not-found page with quick links and a home CTA.",
    category: "utility",
    supportedPageTypes: ["utility"],
    tags: ["error", "404", "utility", "content"],
    sectionId: "body",
    sectionLabel: "Body",
  },
  {
    templateKey: "tpl-privacy-policy",
    displayName: "Privacy Policy",
    description: "Legal prose starter with scannable policy section headings.",
    category: "legal",
    supportedPageTypes: ["legal"],
    tags: ["legal", "privacy", "documentation", "content"],
    sectionId: "body",
    sectionLabel: "Body",
  },
  {
    templateKey: "tpl-terms",
    displayName: "Terms & Conditions",
    description: "Terms of use starter with scannable legal section headings.",
    category: "legal",
    supportedPageTypes: ["legal"],
    tags: ["legal", "terms", "documentation", "content"],
    sectionId: "body",
    sectionLabel: "Body",
  },
  {
    templateKey: "tpl-generic-content",
    displayName: "Generic Content Page",
    description: "Long-form article starter with hero image and related reading band.",
    category: "content",
    supportedPageTypes: ["generic-content"],
    tags: ["generic", "prose", "content", "documentation", "business"],
    sectionId: "body",
    sectionLabel: "Body",
  },
  {
    templateKey: "tpl-homepage",
    displayName: "Homepage",
    description: "Primary marketing home with hero, proof, services, and conversion CTA.",
    category: "marketing",
    supportedPageTypes: ["homepage"],
    tags: ["home", "brand", "conversion", "business", "company", "marketing"],
    featured: true,
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-services",
    displayName: "Services",
    description: "Services overview with offering cards, benefits, and contact CTA.",
    category: "marketing",
    supportedPageTypes: ["generic-content"],
    tags: ["services", "offerings", "business", "company", "agency", "marketing"],
    featured: true,
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-service-detail",
    displayName: "Service Detail",
    description: "Sell one service line with benefits, proof, and related offerings.",
    category: "marketing",
    supportedPageTypes: ["service-detail"],
    tags: ["service", "services", "business", "company", "marketing", "content"],
    featured: true,
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-industry-detail",
    displayName: "Industry Detail",
    description: "Vertical landing page with outcomes, proof, and related services.",
    category: "marketing",
    supportedPageTypes: ["industry-detail"],
    tags: ["industry", "vertical", "services", "business", "company", "marketing"],
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-pricing",
    displayName: "Pricing",
    description: "Pricing page with plan comparison, FAQ, and sales CTA.",
    category: "marketing",
    supportedPageTypes: ["generic-content"],
    tags: ["pricing", "plans", "conversion", "product", "startup", "marketing"],
    featured: true,
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-team",
    displayName: "Team",
    description: "Team page with culture intro, member grid, and careers CTA.",
    category: "marketing",
    supportedPageTypes: ["about"],
    tags: ["team", "people", "culture", "company", "business", "agency"],
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-careers",
    displayName: "Careers",
    description: "Employer brand page with culture story, open roles, and apply CTA.",
    category: "marketing",
    supportedPageTypes: ["careers"],
    tags: ["careers", "employer-brand", "company", "business", "hiring", "team"],
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-faq",
    displayName: "FAQ",
    description: "Support hub with common questions and contact CTA.",
    category: "content",
    supportedPageTypes: ["generic-content"],
    tags: ["faq", "support", "help", "content", "services", "documentation"],
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-features",
    displayName: "Features",
    description: "Product features page with benefit grid and conversion CTA.",
    category: "marketing",
    supportedPageTypes: ["generic-content"],
    tags: ["features", "product", "marketing", "startup", "saas", "business"],
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-testimonials",
    displayName: "Testimonials",
    description: "Social proof page with customer quotes and a closing CTA.",
    category: "marketing",
    supportedPageTypes: ["generic-content"],
    tags: ["testimonials", "social-proof", "marketing", "company", "business", "agency"],
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-product-landing",
    displayName: "Product Landing",
    description: "Product launch landing with hero, features, proof, and pricing CTA.",
    category: "campaign",
    supportedPageTypes: ["landing"],
    tags: ["product", "landing", "marketing", "startup", "pricing", "campaign"],
    featured: true,
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-case-study",
    displayName: "Case Study",
    description: "Customer story with challenge, results, proof stats, and CTA.",
    category: "content",
    supportedPageTypes: ["generic-content"],
    tags: ["case-study", "portfolio", "content", "business", "marketing", "company"],
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-blog-listing",
    displayName: "Blog Home",
    description: "Blog index with article cards — bind a Collection List for live posts.",
    category: "content",
    supportedPageTypes: ["blog-listing"],
    tags: ["blog", "listing", "content", "marketing", "company", "documentation"],
    sectionId: "body",
    sectionLabel: "Body",
  },
  {
    templateKey: "tpl-blog-detail",
    displayName: "Blog Post",
    description: "Single article layout with hero image, body prose, and related posts.",
    category: "content",
    supportedPageTypes: ["blog-detail"],
    tags: ["blog", "article", "content", "marketing", "documentation"],
    sectionId: "body",
    sectionLabel: "Body",
  },
  {
    templateKey: "tpl-resource-listing",
    displayName: "Resource Listing",
    description: "Index of guides, PDFs, and case studies with download cards.",
    category: "content",
    supportedPageTypes: ["resource-listing"],
    tags: ["resources", "listing", "content", "documentation", "marketing"],
    sectionId: "hero",
    sectionLabel: "Hero",
  },
  {
    templateKey: "tpl-resource-detail",
    displayName: "Resource Detail",
    description: "Single resource page with summary, download CTA, and related items.",
    category: "content",
    supportedPageTypes: ["resource-detail"],
    tags: ["resource", "download", "content", "documentation", "marketing"],
    sectionId: "body",
    sectionLabel: "Body",
  },
];

/** Published version for builtin starter layouts + catalog previews (PR #59). */
export const BUILTIN_SKELETON_SEED_VERSION = "1.4.0";

/**
 * Compare semver strings (major.minor.patch). Returns -1 if a < b, 0 if equal, 1 if a > b.
 * Numeric segments only — e.g. 1.2.10 > 1.2.9 and 1.10.0 > 1.9.0.
 */
export function compareSemverVersions(a: string, b: string): -1 | 0 | 1 {
  const parse = (version: string): [number, number, number] => {
    const [major = "0", minor = "0", patch = "0"] = version.split(".");
    return [Number(major), Number(minor), Number(patch)];
  };

  const [aMajor, aMinor, aPatch] = parse(a);
  const [bMajor, bMinor, bPatch] = parse(b);

  if (aMajor !== bMajor) return aMajor > bMajor ? 1 : -1;
  if (aMinor !== bMinor) return aMinor > bMinor ? 1 : -1;
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1;
  return 0;
}

/** Catalog preview asset paths (admin `public/templates/previews/`). */
export function thumbnailFor(templateKey: string): string {
  return `/templates/previews/${templateKey}-thumb.svg`;
}

function starterContent(def: BuiltinSkeletonSeedDef) {
  const build = STARTER_LAYOUT_BUILDERS[def.templateKey];
  if (!build) {
    throw new Error(`Missing starter layout builder for ${def.templateKey}`);
  }
  return {
    contentSchemaVersion: SKELETON_CONTENT_SCHEMA_VERSION,
    layout: build(),
    sections: [
      {
        id: def.sectionId,
        label: def.sectionLabel,
        required: true,
        optional: false,
        defaultEnabled: true,
        order: 0,
      },
    ],
    pageStructure: {
      defaultSectionOrder: [def.sectionId],
      requiredSectionIds: [def.sectionId],
      optionalSectionIds: [] as string[],
    },
    componentProps: {},
  };
}

/**
 * Apply the same migrate/repair pass `TemplateSkeletonsService.create` runs, so
 * seeded rows are shape-identical to skeletons created over HTTP.
 */
function normalizeSeedLayout(layout: Record<string, unknown>): Record<string, unknown> {
  return deserializeLayout(JSON.stringify(layout)) as unknown as Record<string, unknown>;
}

/** Build and validate create payloads for all builtin skeleton seed defs. */
export function getBuiltinSkeletonSeedInputs(): CreateTemplateSkeletonInput[] {
  return BUILTIN_SKELETON_SEED_DEFS.map((def) => {
    const input = parseCreateTemplateSkeletonInput({
      templateKey: def.templateKey,
      displayName: def.displayName,
      description: def.description,
      category: def.category,
      supportedPageTypes: def.supportedPageTypes,
      tags: def.tags,
      version: BUILTIN_SKELETON_SEED_VERSION,
      status: "published",
      schemaVersion: SKELETON_CONTENT_SCHEMA_VERSION,
      previewMetadata: {
        thumbnail: thumbnailFor(def.templateKey),
        ...(def.featured !== undefined ? { featured: def.featured } : {}),
      },
      content: starterContent(def),
    });
    input.content.layout = normalizeSeedLayout(input.content.layout);
    return input;
  });
}

export type SkeletonSeedStore = {
  findActiveByKey(templateKey: string): Promise<{ id: string; version: string } | null>;
  insertSkeleton(input: CreateTemplateSkeletonInput): Promise<void>;
  refreshSkeleton(id: string, input: CreateTemplateSkeletonInput): Promise<void>;
};

export type SeedBuiltinSkeletonsResult = {
  inserted: string[];
  refreshed: string[];
  skipped: string[];
};

/** Partial unique index on active `templateKey` — the only conflict a re-run may skip. */
const TEMPLATE_KEY_ACTIVE_UIDX = "tsk_template_key_active_uidx";

/**
 * A concurrent seed already claimed this `templateKey`. Scoped to the one index
 * so any other unique violation surfaces instead of being logged as a skip.
 */
function isTemplateKeyConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { code, constraint } = err as { code?: string; constraint?: string };
  return code === "23505" && constraint === TEMPLATE_KEY_ACTIVE_UIDX;
}

type SeedTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Apply seed refresh only when the stored row is strictly older (optimistic version match). */
async function applyRefreshIfNewer(
  tx: SeedTx,
  id: string,
  input: CreateTemplateSkeletonInput,
): Promise<boolean> {
  const [row] = await tx
    .select({ version: templateSkeletons.version })
    .from(templateSkeletons)
    .where(and(eq(templateSkeletons.id, id), isNull(templateSkeletons.deletedAt)))
    .limit(1);

  if (!row || compareSemverVersions(input.version, row.version) <= 0) {
    return false;
  }

  const [updated] = await tx
    .update(templateSkeletons)
    .set({
      description: input.description,
      previewMetadata: input.previewMetadata,
      version: input.version,
      updatedAt: new Date(),
    })
    .where(and(eq(templateSkeletons.id, id), eq(templateSkeletons.version, row.version)))
    .returning({ id: templateSkeletons.id });

  if (!updated) {
    return false;
  }

  await tx
    .update(templateSkeletonContents)
    .set({
      layout: input.content.layout,
      sections: input.content.sections,
      pageStructure: input.content.pageStructure,
      componentProps: input.content.componentProps,
      contentSchemaVersion: input.content.contentSchemaVersion,
      updatedAt: new Date(),
    })
    .where(eq(templateSkeletonContents.skeletonId, id));

  return true;
}

/** Create a Drizzle-backed store matching TemplateSkeletonRepository insert shape. */
export function createDrizzleSkeletonSeedStore(db: Database): SkeletonSeedStore {
  const versions = new TemplateSkeletonVersionRepository(db);
  const repository = new TemplateSkeletonRepository(db, versions);

  const snapshotAfterChangeInTx = async (
    tx: SeedTx,
    templateKey: string,
  ): Promise<void> => {
    const record = await repository.findByKeyInTx(tx, templateKey);
    if (record) {
      await versions.appendIfChangedWithTx(tx, record, null);
    }
  };

  return {
    async findActiveByKey(templateKey: string) {
      const [row] = await db
        .select({ id: templateSkeletons.id, version: templateSkeletons.version })
        .from(templateSkeletons)
        .where(
          and(eq(templateSkeletons.templateKey, templateKey), isNull(templateSkeletons.deletedAt)),
        )
        .limit(1);
      return row ?? null;
    },

    async refreshSkeleton(id: string, input: CreateTemplateSkeletonInput) {
      await db.transaction(async (tx) => {
        if (await applyRefreshIfNewer(tx, id, input)) {
          await snapshotAfterChangeInTx(tx, input.templateKey);
        }
      });
    },

    async insertSkeleton(input: CreateTemplateSkeletonInput) {
      await db.transaction(async (tx) => {
        const [meta] = await tx
          .insert(templateSkeletons)
          .values({
            templateKey: input.templateKey,
            displayName: input.displayName,
            description: input.description,
            category: input.category,
            tags: input.tags,
            supportedPageTypes: input.supportedPageTypes,
            previewMetadata: input.previewMetadata,
            version: input.version,
            status: input.status,
            schemaVersion: input.schemaVersion,
            createdBy: null,
            updatedBy: null,
          })
          .returning({ id: templateSkeletons.id });

        await tx.insert(templateSkeletonContents).values({
          skeletonId: meta.id,
          layout: input.content.layout,
          sections: input.content.sections,
          pageStructure: input.content.pageStructure,
          componentProps: input.content.componentProps,
          contentSchemaVersion: input.content.contentSchemaVersion,
          createdBy: null,
          updatedBy: null,
        });

        await snapshotAfterChangeInTx(tx, input.templateKey);
      });
    },
  };
}

/**
 * Idempotently insert or refresh builtin skeleton seeds via an abstract store.
 * Inserts when missing; refreshes layout + previews when the seed version advances.
 */
export async function seedBuiltinTemplateSkeletonsWithStore(
  store: SkeletonSeedStore,
  options?: {
    log?: (message: string) => void;
    inputs?: CreateTemplateSkeletonInput[];
  },
): Promise<SeedBuiltinSkeletonsResult> {
  const log = options?.log ?? (() => undefined);
  const inputs = options?.inputs ?? getBuiltinSkeletonSeedInputs();
  const inserted: string[] = [];
  const refreshed: string[] = [];
  const skipped: string[] = [];

  for (const input of inputs) {
    const existing = await store.findActiveByKey(input.templateKey);
    if (existing) {
      const versionCompare = compareSemverVersions(input.version, existing.version);
      if (versionCompare > 0) {
        await store.refreshSkeleton(existing.id, input);
        const afterRefresh = await store.findActiveByKey(input.templateKey);
        if (afterRefresh && compareSemverVersions(input.version, afterRefresh.version) === 0) {
          refreshed.push(input.templateKey);
          log(`SEED :: refreshed template skeleton ${input.templateKey} → v${input.version}`);
        } else {
          skipped.push(input.templateKey);
          const currentVersion = afterRefresh?.version ?? existing.version;
          log(
            `SEED :: template skeleton ${input.templateKey} v${currentVersion} is newer than seed v${input.version} — skipped`,
          );
        }
      } else if (versionCompare === 0) {
        skipped.push(input.templateKey);
        log(`SEED :: template skeleton ${input.templateKey} already exists — skipped`);
      } else {
        skipped.push(input.templateKey);
        log(
          `SEED :: template skeleton ${input.templateKey} v${existing.version} is newer than seed v${input.version} — skipped`,
        );
      }
      continue;
    }

    try {
      await store.insertSkeleton(input);
      inserted.push(input.templateKey);
      log(`SEED :: created template skeleton ${input.templateKey}`);
    } catch (err) {
      if (isTemplateKeyConflict(err)) {
        skipped.push(input.templateKey);
        log(`SEED :: template skeleton ${input.templateKey} race/duplicate — skipped`);
        continue;
      }
      throw err;
    }
  }

  return { inserted, refreshed, skipped };
}

/** Backfill version history for skeletons that pre-date the versions table. */
export async function backfillBuiltinSkeletonVersionHistory(
  db: Database,
  options?: { log?: (message: string) => void },
): Promise<number> {
  const log = options?.log ?? (() => undefined);
  const versions = new TemplateSkeletonVersionRepository(db);
  const repository = new TemplateSkeletonRepository(db, versions);
  const rows = await repository.list({});
  let backfilled = 0;

  for (const record of rows) {
    const created = await backfillSkeletonVersionIfEmpty(db, record);
    if (created) {
      backfilled += 1;
      log(`SEED :: backfilled version history for ${record.metadata.templateKey} @ v${record.metadata.version}`);
    }
  }

  return backfilled;
}

/** Idempotent seed entrypoint used by `db:seed`. */
export async function seedBuiltinTemplateSkeletons(
  db: Database,
  options?: { log?: (message: string) => void },
): Promise<SeedBuiltinSkeletonsResult> {
  const result = await seedBuiltinTemplateSkeletonsWithStore(createDrizzleSkeletonSeedStore(db), options);
  await backfillBuiltinSkeletonVersionHistory(db, options);
  return result;
}

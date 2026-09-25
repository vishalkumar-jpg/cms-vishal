import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { db } from "../db/db";
import { pageAudits, sites, type PageAuditRecommendation } from "../db/schema";

/**
 * Page-audit processor (#30) — runs a REAL Lighthouse audit against a resolved
 * public URL and writes the four category scores (0..100) + Core Web Vitals
 * (LCP ms, CLS unitless) onto the `page_audits` row identified by `auditId`.
 * Postgres is the source of truth; ids + the pre-resolved URL + tenant Host
 * travel through Redis (the API resolves both for the site+path).
 *
 * IMPORTANT — Chromium requirement (guarded, mirrors sharp/pg_dump):
 *   Lighthouse drives a headless Chrome located by `chrome-launcher` (or the
 *   `CHROME_PATH` env override). Both `lighthouse` and `chrome-launcher` are
 *   loaded via GUARDED dynamic imports and the whole run is timeout-guarded, so
 *   when the deps are missing, no Chrome binary is found, or the run throws, the
 *   row is marked `skipped`/`failed` with a clear message and the worker NEVER
 *   crashes.
 */

/** Lighthouse categories we request + read scores from. */
const CATEGORIES = ["performance", "accessibility", "seo", "best-practices"] as const;

/** Hard ceiling on a single audit run (Chrome launch + Lighthouse pass). */
const RUN_TIMEOUT_MS = Number(process.env.PAGE_AUDIT_TIMEOUT_MS ?? "60000");

const CHROMIUM_UNAVAILABLE_MSG =
  "Chromium not available — install a headless Chrome + set CHROME_PATH (and `bun add lighthouse chrome-launcher`) to enable real audits";

export interface PageAuditJobData {
  auditId: string;
  siteId: string;
  path: string;
  url: string;
  hostHeader?: string;
}

/** Guarded dynamic import of `lighthouse` (ESM default export). */
async function loadLighthouse(): Promise<any | null> {
  try {
    const mod = await import(/* @vite-ignore */ "lighthouse" as string);
    return (mod as { default?: unknown }).default ?? mod;
  } catch {
    return null;
  }
}

/** Guarded dynamic import of `chrome-launcher`. */
async function loadChromeLauncher(): Promise<any | null> {
  try {
    const mod = await import(/* @vite-ignore */ "chrome-launcher" as string);
    return (mod as { default?: unknown }).default ?? mod;
  } catch {
    return null;
  }
}

/** True when `withTimeout` rejected — inner Chrome/Lighthouse work may still be running. */
function isTimeoutError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? String(err);
  return msg.includes("timed out");
}

/** Reject after `ms` so a hung Chrome/Lighthouse never wedges the worker. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`page-audit timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Lighthouse category score is 0..1 (or null); scale to a 0..100 integer. */
function toScore(category: any): number | null {
  const raw = category?.score;
  return typeof raw === "number" ? Math.round(raw * 100) : null;
}

/** Numeric audit value (ms for LCP, unitless for CLS), else null. */
function numericValue(audit: any): number | null {
  const raw = audit?.numericValue;
  return typeof raw === "number" ? raw : null;
}

/** Cap on stored recommendations so one row can never balloon. */
const MAX_RECOMMENDATIONS = 100;

/** How many affected-element samples we keep per recommendation. */
const MAX_AFFECTED_SAMPLES = 3;

/**
 * Best-effort label for one LHR `details.items` entry: prefer a URL, else a DOM
 * node selector/snippet, else a nested source url. Trimmed + length-capped.
 */
function affectedLabel(item: any): string | null {
  const raw =
    item?.url ??
    item?.node?.selector ??
    item?.node?.snippet ??
    item?.source?.url ??
    item?.source ??
    null;
  if (typeof raw !== "string") return null;
  const label = raw.trim();
  return label ? label.slice(0, 200) : null;
}

/** Count + sample the affected elements from an audit's `details.items`. */
function affectedElements(details: any): { count?: number; samples?: string[] } {
  const items = Array.isArray(details?.items) ? details.items : [];
  if (items.length === 0) return {};
  const samples = items
    .map(affectedLabel)
    .filter((v: string | null): v is string => !!v)
    .slice(0, MAX_AFFECTED_SAMPLES);
  return { count: items.length, samples: samples.length ? samples : undefined };
}

/**
 * Normalize the LHR `audits` map into actionable recommendations: keep only
 * items with a numeric score < 1 (i.e. failing/imperfect + applicable — this
 * drops passing, not-applicable, informative and manual audits), tag each with
 * its Lighthouse category and estimated savings, then sort by biggest impact.
 */
function extractRecommendations(lhr: any): PageAuditRecommendation[] {
  const cats = lhr?.categories ?? {};
  const audits = lhr?.audits ?? {};

  // Map auditId → owning category via each category's auditRefs.
  const categoryOf = new Map<string, string>();
  for (const categoryId of CATEGORIES) {
    const refs = cats[categoryId]?.auditRefs ?? [];
    for (const ref of refs) {
      if (ref?.id && !categoryOf.has(ref.id)) categoryOf.set(ref.id, categoryId);
    }
  }

  const out: PageAuditRecommendation[] = [];
  for (const [id, audit] of Object.entries<any>(audits)) {
    const score = typeof audit?.score === "number" ? audit.score : null;
    if (score === null || score >= 1) continue;
    const details = audit?.details ?? {};
    const savingsMs = typeof details.overallSavingsMs === "number" ? Math.round(details.overallSavingsMs) : undefined;
    const savingsBytes =
      typeof details.overallSavingsBytes === "number" ? Math.round(details.overallSavingsBytes) : undefined;
    const affected = affectedElements(details);
    out.push({
      id,
      title: String(audit?.title ?? id).slice(0, 300),
      description: String(audit?.description ?? "").slice(0, 2000),
      category: categoryOf.get(id) ?? "performance",
      score,
      displayValue: audit?.displayValue ? String(audit.displayValue).slice(0, 200) : undefined,
      savingsMs,
      savingsBytes,
      affectedCount: affected.count,
      affectedSamples: affected.samples,
    });
  }

  // Biggest time savings first, then worst score first.
  out.sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0) || (a.score ?? 0) - (b.score ?? 0));
  return out.slice(0, MAX_RECOMMENDATIONS);
}

function formatErr(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ? `${err.message}\n${err.stack}` : err.message;
  }
  return String(err);
}

function logStage(
  stage: string,
  data: { auditId: string; siteId: string; path: string; url: string; hostHeader: string },
  extra?: string,
): void {
  const base = `[worker:page-audit] ${stage} audit=${data.auditId} site=${data.siteId} path=${data.path} url=${data.url} host=${data.hostHeader}`;
  if (extra) console.log(`${base} — ${extra}`);
  else console.log(base);
}

/** Resolve tenant Host for Lighthouse when older jobs omitted hostHeader. */
async function resolveHostHeader(siteId: string, hostHeader?: string): Promise<string> {
  if (hostHeader) return hostHeader;
  const [site] = await db
    .select({
      subdomain: sites.subdomain,
      primaryDomain: sites.primaryDomain,
      customDomain: sites.customDomain,
    })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  if (!site) return "localhost";
  const domain = site.primaryDomain || site.customDomain;
  if (domain) return domain;
  const baseDomain = process.env.PLATFORM_BASE_DOMAIN;
  if (baseDomain) return `${site.subdomain}.${baseDomain}`;
  return `${site.subdomain}.localhost`;
}

/**
 * Chrome rejects loopback navigations that override Host via extraHeaders
 * (`CHROME_INTERSTITIAL_ERROR`). Rewrite `localhost`/`127.0.0.1` URLs to the
 * tenant hostname (preserving port/path) so the Host is natural and Lighthouse
 * hits the correct renderer site. No-ops when already non-loopback or when
 * hostHeader is missing/blank.
 */
function resolveNavigableAuditUrl(url: string, hostHeader: string): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return url;
    const tenantHost = hostHeader.split(":")[0]?.trim();
    if (!tenantHost || tenantHost === "localhost" || tenantHost === "127.0.0.1") return url;
    u.hostname = tenantHost;
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Prefer not to set Host via extraHeaders — Chromium treats that as an
 * interstitial. Only used as a last resort if the URL is still loopback after
 * resolveNavigableAuditUrl (e.g. missing hostHeader on a legacy job).
 */
function lighthouseExtraHeaders(url: string, hostHeader: string): Record<string, string> | undefined {
  try {
    const { hostname } = new URL(url);
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      console.warn(
        `[worker:page-audit] Host override on loopback URL may cause Chrome interstitial: url=${url} host=${hostHeader}`,
      );
      return { Host: hostHeader };
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Best-effort Chrome teardown — never throws. */
async function safeKillChrome(chrome: any, auditId: string): Promise<void> {
  if (!chrome || typeof chrome.kill !== "function") return;
  try {
    await chrome.kill();
  } catch (err) {
    console.warn(`[worker:page-audit] chrome.kill failed for ${auditId}:`, (err as Error).message);
  }
}

/** Surface renderer/Lighthouse navigation failures as audit failures. */
function assertPageLoaded(lhr: any, url: string): void {
  const runtimeError = lhr?.runtimeError;
  if (runtimeError) {
    const code = runtimeError.code ? ` [${runtimeError.code}]` : "";
    const msg = runtimeError.message || "unknown renderer error";
    throw new Error(`Renderer/Lighthouse navigation failed for ${url}${code}: ${msg}`);
  }
  const requests = lhr?.audits?.["network-requests"]?.details?.items;
  if (Array.isArray(requests)) {
    const doc = requests.find(
      (r: { resourceType?: string; mimeType?: string; statusCode?: number }) =>
        r.resourceType === "Document" || (r.mimeType && String(r.mimeType).includes("text/html")),
    );
    if (doc && typeof doc.statusCode === "number" && doc.statusCode >= 400) {
      throw new Error(`Renderer returned HTTP ${doc.statusCode} for ${url}`);
    }
  }
}

async function markSkipped(auditId: string, message: string): Promise<void> {
  await db
    .update(pageAudits)
    .set({ status: "skipped", detail: message.slice(0, 500), ranAt: new Date() })
    .where(eq(pageAudits.id, auditId));
  console.warn(`[worker:page-audit] skipped ${auditId}: ${message}`);
}

/** A genuine run failure (as opposed to a `skipped` env limitation). */
async function markFailed(auditId: string, message: string): Promise<void> {
  await db
    .update(pageAudits)
    .set({ status: "failed", detail: message.slice(0, 500), ranAt: new Date() })
    .where(eq(pageAudits.id, auditId));
  console.warn(`[worker:page-audit] failed ${auditId}: ${message}`);
}

/** Terminal audit states — never re-run Lighthouse for these rows. */
const TERMINAL_AUDIT_STATUSES = new Set(["completed", "failed", "skipped"]);

/**
 * Run Lighthouse for one `page_audits` row. Chromium-unavailable is a terminal
 * `skipped`. Timeout errors are terminal `failed` (inner work cannot be
 * cancelled reliably). Other transient failures are re-thrown while BullMQ
 * attempts remain; the final attempt marks the row `failed` with the reason in
 * `detail`.
 */
export async function processPageAudit(
  job: Job<PageAuditJobData>,
): Promise<{ ok: boolean; status: string }> {
  const { auditId, siteId, path, url } = job.data;
  if (!auditId) return { ok: false, status: "noop" };

  const hostHeader = await resolveHostHeader(siteId, job.data.hostHeader);
  const navigableUrl = resolveNavigableAuditUrl(url, hostHeader);
  const ctx = { auditId, siteId, path, url: navigableUrl, hostHeader };

  const [row] = await db.select().from(pageAudits).where(eq(pageAudits.id, auditId)).limit(1);
  if (!row) {
    console.warn(`[worker:page-audit] noop — audit row not found: ${auditId}`);
    return { ok: false, status: "noop" };
  }
  if (TERMINAL_AUDIT_STATUSES.has(row.status)) {
    logStage("noop-terminal", ctx, row.status);
    return { ok: true, status: row.status };
  }

  if (navigableUrl !== url) {
    console.log(
      `[worker:page-audit] rewritten loopback audit URL audit=${auditId} from=${url} to=${navigableUrl}`,
    );
  }
  logStage("start", ctx);

  // Mark the row as actively running so bulk-scan progress can distinguish
  // "queued" (pending) from "in-flight" (running).
  await db.update(pageAudits).set({ status: "running", detail: null }).where(eq(pageAudits.id, auditId));

  const lighthouse = await loadLighthouse();
  const chromeLauncher = await loadChromeLauncher();
  if (!lighthouse || !chromeLauncher) {
    await markSkipped(auditId, CHROMIUM_UNAVAILABLE_MSG);
    return { ok: true, status: "skipped" };
  }

  let chrome: any = null;
  try {
    const result = await withTimeout(
      (async () => {
        logStage("chrome-launch", ctx);
        chrome = await chromeLauncher.launch({
          chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
          chromePath: process.env.CHROME_PATH || undefined,
        });
        logStage("lighthouse-run", ctx, `port=${chrome?.port ?? "?"}`);
        const extraHeaders = lighthouseExtraHeaders(navigableUrl, hostHeader);
        const runnerResult = await lighthouse(navigableUrl, {
          port: chrome.port,
          output: "json",
          logLevel: "error",
          onlyCategories: CATEGORIES as unknown as string[],
          formFactor: "mobile",
          ...(extraHeaders ? { extraHeaders } : {}),
        });
        return runnerResult;
      })(),
      RUN_TIMEOUT_MS,
    );

    const lhr = result?.lhr;
    if (!lhr) throw new Error("Lighthouse returned no report");

    assertPageLoaded(lhr, navigableUrl);

    const cats = lhr.categories ?? {};
    const audits = lhr.audits ?? {};

    const performanceScore = toScore(cats["performance"]);
    const accessibilityScore = toScore(cats["accessibility"]);
    const seoScore = toScore(cats["seo"]);
    const bestPracticesScore = toScore(cats["best-practices"]);
    if (
      performanceScore === null &&
      accessibilityScore === null &&
      seoScore === null &&
      bestPracticesScore === null
    ) {
      throw new Error(`Lighthouse returned no category scores for ${navigableUrl}`);
    }

    await db
      .update(pageAudits)
      .set({
        status: "completed",
        performanceScore,
        accessibilityScore,
        seoScore,
        bestPracticesScore,
        lcp: numericValue(audits["largest-contentful-paint"]),
        cls: numericValue(audits["cumulative-layout-shift"]),
        recommendations: extractRecommendations(lhr),
        detail: null,
        ranAt: new Date(),
      })
      .where(eq(pageAudits.id, auditId));

    logStage("completed", ctx, `perf=${performanceScore}`);
    return { ok: true, status: "completed" };
  } catch (err) {
    const full = formatErr(err);
    const errObj = err instanceof Error ? err : new Error(String(err));
    const message = errObj.message.slice(0, 300);
    console.error("Lighthouse failed", {
      auditId,
      siteId,
      path,
      url: navigableUrl,
      queuedUrl: url,
      hostHeader,
      error: errObj.message,
      stack: errObj.stack,
    });
    console.error(`[worker:page-audit] error audit=${auditId} site=${siteId} path=${path}\n${full}`);

    const maxAttempts = job.opts.attempts ?? 1;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const timeout = isTimeoutError(err);
    // Timeouts are terminal: withTimeout only rejects the waiter; Chrome/Lighthouse
    // may keep running and a retry would stack another instance.
    // Re-throw other errors while retries remain so BullMQ backoff can fire. Stay
    // pending so the next attempt isn't stuck looking "running" forever if the worker dies.
    if (!timeout && attempt < maxAttempts) {
      await db
        .update(pageAudits)
        .set({ status: "pending", detail: message.slice(0, 500) })
        .where(eq(pageAudits.id, auditId));
      throw err instanceof Error ? err : new Error(message);
    }
    await markFailed(auditId, message);
    return { ok: true, status: "failed" };
  } finally {
    await safeKillChrome(chrome, auditId);
  }
}

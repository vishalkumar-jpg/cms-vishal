import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { db } from "../db/db";
import { brokenLinks, linkChecks, pages } from "../db/schema";
import { generateKSUIDWithPrefixSync } from "../db/ksuid";

/**
 * Broken-link checker (SITE-HEALTH). Given a `link_checks` run, this processor:
 *   1. loads the site's PUBLISHED pages (status='published') → their paths,
 *   2. fetches each page's HTML from the renderer (host-resolved via the Host
 *      header carried on the job) — capped page count, short timeout,
 *   3. extracts `<a href>` links, resolves internal ones against the site base,
 *      dedupes the unique targets (capped),
 *   4. HEAD (falling back to GET) each unique target with a short timeout +
 *      bounded concurrency, recording every non-2xx/3xx (or dns/timeout/error)
 *      onto `broken_links`,
 *   5. writes the summary (pages/links/broken counts) + `completed` status.
 *
 * GUARDED end-to-end: every fetch is wrapped so a network error is RECORDED
 * (never thrown) — the worker never crashes and BullMQ never retry-storms. In a
 * sandbox where the renderer/external hosts are unreachable, the run still
 * completes; unreachable targets are simply recorded as `dns`/`timeout`/`error`.
 */

/** Hard caps so one run can never wedge the worker or hammer the network. */
const MAX_PAGES = Number(process.env.LINK_CHECK_MAX_PAGES ?? "50");
const MAX_LINKS = Number(process.env.LINK_CHECK_MAX_LINKS ?? "300");
const CONCURRENCY = Number(process.env.LINK_CHECK_CONCURRENCY ?? "8");
const FETCH_TIMEOUT_MS = Number(process.env.LINK_CHECK_TIMEOUT_MS ?? "8000");

export interface LinkCheckJobData {
  runId: string;
  siteId: string;
  baseUrl: string;
  hostHeader: string;
}

interface LinkTarget {
  url: string;
  kind: "internal" | "external";
  sourcePath: string;
}

/** A broken result to persist. */
interface BrokenResult extends LinkTarget {
  status: string;
}

/** `fetch` with a timeout + the tenant Host header; resolves null on any error. */
async function guardedFetch(
  url: string,
  method: "GET" | "HEAD",
  hostHeader: string | undefined,
): Promise<{ status: number } | { error: "timeout" | "dns" | "error" }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "user-agent": "ob-cms-link-check/1.0" };
    if (hostHeader) headers["host"] = hostHeader;
    const res = await fetch(url, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers,
    });
    return { status: res.status };
  } catch (err) {
    const name = (err as Error).name;
    const code = (err as { cause?: { code?: string } }).cause?.code;
    if (name === "AbortError") return { error: "timeout" };
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") return { error: "dns" };
    return { error: "error" };
  } finally {
    clearTimeout(timer);
  }
}

/** Extract raw href values from an HTML string (no DOM; a tolerant regex). */
function extractHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = (m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (href) out.push(href);
  }
  return out;
}

/** Resolve/classify one raw href against the site base; null → skip (mailto etc). */
function classifyHref(href: string, baseUrl: string): { url: string; kind: "internal" | "external" } | null {
  // Skip non-navigational schemes + in-page anchors.
  if (/^(mailto:|tel:|javascript:|data:|#)/i.test(href)) return null;
  try {
    const resolved = new URL(href, baseUrl + "/");
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    const base = new URL(baseUrl + "/");
    const kind = resolved.host === base.host ? "internal" : "external";
    // Strip the fragment for dedupe (same page, different anchor = same target).
    resolved.hash = "";
    return { url: resolved.toString(), kind };
  } catch {
    return null;
  }
}

/** A 2xx/3xx status is "ok"; anything else (or a network error) is broken. */
function isOkStatus(status: number): boolean {
  return status >= 200 && status < 400;
}

/** Probe unique targets with bounded concurrency; return the broken ones. */
async function probeTargets(
  targets: Map<string, LinkTarget>,
  hostFor: (t: LinkTarget) => string | undefined,
): Promise<BrokenResult[]> {
  const list = [...targets.values()];
  const broken: BrokenResult[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= list.length) return;
      const t = list[i];
      // HEAD first (cheap); some servers reject HEAD → fall back to GET.
      let res = await guardedFetch(t.url, "HEAD", hostFor(t));
      if ("status" in res && (res.status === 405 || res.status === 501)) {
        res = await guardedFetch(t.url, "GET", hostFor(t));
      }
      if ("error" in res) {
        broken.push({ ...t, status: res.error });
      } else if (!isOkStatus(res.status)) {
        broken.push({ ...t, status: String(res.status) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, () => worker()));
  return broken;
}

async function finish(
  runId: string,
  fields: { status: string; pagesCrawled?: number; linksChecked?: number; brokenCount?: number; detail?: string },
): Promise<void> {
  await db
    .update(linkChecks)
    .set({ ...fields, finishedAt: new Date() })
    .where(eq(linkChecks.id, runId));
}

export async function processLinkCheck(
  job: Job<LinkCheckJobData>,
): Promise<{ ok: boolean; status: string; broken: number }> {
  const { runId, siteId, baseUrl, hostHeader } = job.data;
  if (!runId) return { ok: false, status: "noop", broken: 0 };

  const [run] = await db.select().from(linkChecks).where(eq(linkChecks.id, runId)).limit(1);
  if (!run) return { ok: false, status: "noop", broken: 0 };

  try {
    // 1. Published pages → paths (capped).
    const publishedPages = await db
      .select({ slug: pages.slug, status: pages.status })
      .from(pages)
      .where(eq(pages.siteId, siteId))
      .limit(MAX_PAGES * 4);
    const paths = publishedPages
      .filter((p) => p.status === "published")
      .slice(0, MAX_PAGES)
      .map((p) => (p.slug === "index" || p.slug === "home" ? "/" : `/${p.slug.replace(/^\/+/, "")}`));
    // Always include the site root.
    if (!paths.includes("/")) paths.unshift("/");

    // 2 + 3. Fetch each page's HTML, extract + classify unique targets.
    const targets = new Map<string, LinkTarget>();
    let pagesCrawled = 0;

    for (const path of paths) {
      if (targets.size >= MAX_LINKS) break;
      const pageUrl = `${baseUrl}${path}`;
      const res = await guardedFetch(pageUrl, "GET", hostHeader);
      pagesCrawled++;
      if ("error" in res || !isOkStatus(res.status)) continue;
      // guardedFetch used manual redirect + only returns status; re-fetch body.
      const html = await fetchBody(pageUrl, hostHeader);
      if (!html) continue;
      for (const href of extractHrefs(html)) {
        if (targets.size >= MAX_LINKS) break;
        const c = classifyHref(href, baseUrl);
        if (!c) continue;
        if (!targets.has(c.url)) {
          targets.set(c.url, { url: c.url, kind: c.kind, sourcePath: path });
        }
      }
    }

    // 4. Probe unique targets (internal links carry the tenant Host).
    const broken = await probeTargets(targets, (t) => (t.kind === "internal" ? hostHeader : undefined));

    // 5. Persist broken rows + the run summary.
    if (broken.length) {
      await db.insert(brokenLinks).values(
        broken.map((b) => ({
          id: generateKSUIDWithPrefixSync("blk"),
          siteId,
          runId,
          sourcePath: b.sourcePath.slice(0, 1000),
          targetUrl: b.url.slice(0, 2000),
          kind: b.kind,
          status: b.status,
          checkedAt: new Date(),
        })),
      );
    }

    await finish(runId, {
      status: "completed",
      pagesCrawled,
      linksChecked: targets.size,
      brokenCount: broken.length,
    });
    console.log(
      `[worker:link-check] completed ${runId}: ${pagesCrawled} pages, ${targets.size} links, ${broken.length} broken`,
    );
    return { ok: true, status: "completed", broken: broken.length };
  } catch (err) {
    // GUARDED: any unexpected error marks the run failed (never crashes).
    const message = (err as Error).message || String(err);
    await finish(runId, { status: "failed", detail: message.slice(0, 1000) });
    console.warn(`[worker:link-check] failed ${runId}: ${message}`);
    return { ok: true, status: "failed", broken: 0 };
  }
}

/** Fetch a page body (guarded) — separate from the status probe so we only
 *  download HTML for pages that responded ok. Returns null on any error. */
async function fetchBody(url: string, hostHeader: string | undefined): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "user-agent": "ob-cms-link-check/1.0" };
    if (hostHeader) headers["host"] = hostHeader;
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers });
    if (!isOkStatus(res.status)) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

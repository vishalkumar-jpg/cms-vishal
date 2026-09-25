import tls from "node:tls";
import { and, eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { db } from "../db/db";
import { siteDomains } from "../db/schema";

/**
 * SSL / domain-expiry monitoring (SITE-HEALTH). For each verified custom domain
 * (all of them on the daily sweep, or one on an on-demand re-check) this
 * processor opens a TLS socket to <domain>:443, completes the handshake, reads
 * the peer certificate's `valid_to` and stores it as `tls_expires_at` on the
 * `site_domains` row (+ `tls_checked_at`, clearing/`setting` `tls_check_error`).
 *
 * GUARDED end-to-end: a DNS failure, connection refusal, handshake timeout or a
 * missing/unparseable cert is RECORDED (`tls_check_error` = dns|timeout|no-cert|
 * error, expiry left null) — the socket is always destroyed and the worker never
 * crashes. In a sandbox where :443 is unreachable, the domain is simply recorded
 * as unreachable; the mechanism + no-crash is what matters.
 */

const HANDSHAKE_TIMEOUT_MS = Number(process.env.SSL_CHECK_TIMEOUT_MS ?? "8000");

export interface SslCheckJobData {
  siteId?: string;
  domainId?: string;
}

type CertResult = { validTo: Date } | { error: "dns" | "timeout" | "no-cert" | "error" };

/**
 * Open a TLS socket to `domain:443`, read the peer cert `valid_to`. Always
 * resolves (never rejects) so the caller can record the outcome.
 */
function checkCert(domain: string): Promise<CertResult> {
  return new Promise<CertResult>((resolve) => {
    let settled = false;
    const done = (r: CertResult): void => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(r);
    };

    const socket = tls.connect(
      {
        host: domain,
        port: 443,
        servername: domain,
        // We only want the expiry date, not a trust decision — an expired or
        // self-signed cert must still yield its `valid_to` (we classify it).
        rejectUnauthorized: false,
        timeout: HANDSHAKE_TIMEOUT_MS,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          if (!cert || !cert.valid_to) return done({ error: "no-cert" });
          const validTo = new Date(cert.valid_to);
          if (Number.isNaN(validTo.getTime())) return done({ error: "no-cert" });
          done({ validTo });
        } catch {
          done({ error: "error" });
        }
      },
    );

    socket.on("timeout", () => done({ error: "timeout" }));
    socket.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") return done({ error: "dns" });
      if (err.code === "ETIMEDOUT") return done({ error: "timeout" });
      done({ error: "error" });
    });
  });
}

async function checkOne(row: { id: string; domain: string }): Promise<string> {
  const result = await checkCert(row.domain);
  const now = new Date();
  if ("validTo" in result) {
    await db
      .update(siteDomains)
      .set({ tlsExpiresAt: result.validTo, tlsCheckedAt: now, tlsCheckError: null })
      .where(eq(siteDomains.id, row.id));
    return "ok";
  }
  await db
    .update(siteDomains)
    .set({ tlsCheckedAt: now, tlsCheckError: result.error })
    .where(eq(siteDomains.id, row.id));
  return result.error;
}

export async function processSslCheck(
  job: Job<SslCheckJobData>,
): Promise<{ ok: boolean; checked: number }> {
  const { domainId, siteId } = job.data;

  // Build the target set: one domain, one site's verified domains, or all.
  let rows: Array<{ id: string; domain: string }>;
  if (domainId) {
    rows = await db
      .select({ id: siteDomains.id, domain: siteDomains.domain })
      .from(siteDomains)
      .where(eq(siteDomains.id, domainId))
      .limit(1);
  } else if (siteId) {
    rows = await db
      .select({ id: siteDomains.id, domain: siteDomains.domain })
      .from(siteDomains)
      .where(and(eq(siteDomains.siteId, siteId), eq(siteDomains.verified, true)))
      .limit(500);
  } else {
    rows = await db
      .select({ id: siteDomains.id, domain: siteDomains.domain })
      .from(siteDomains)
      .where(eq(siteDomains.verified, true))
      .limit(2000);
  }

  let checked = 0;
  for (const row of rows) {
    try {
      const outcome = await checkOne(row);
      checked++;
      console.log(`[worker:ssl-check] ${row.domain}: ${outcome}`);
    } catch (err) {
      // GUARDED: a per-domain error never aborts the sweep.
      console.warn(`[worker:ssl-check] ${row.domain} failed`, (err as Error).message);
    }
  }
  return { ok: true, checked };
}

import { Injectable, Logger } from "@nestjs/common";

export type TlsStatus = "none" | "pending" | "issued" | "failed";

export interface TlsProvisionResult {
  status: TlsStatus;
  detail: string;
}

/**
 * TLS provisioning seam.
 *
 * A verified custom domain needs an HTTPS certificate before the renderer can
 * serve it. This interface isolates that concern so the local/dev build never
 * actually talks to a CA.
 *
 * PROD WIRING: replace {@link MockTlsService} with an implementation that either
 *  - requests an ACM certificate + a DNS/HTTP validation record (AWS), or
 *  - drives an ACME (Let's Encrypt) http-01/dns-01 order via e.g. acme-client /
 *    Caddy's on-demand TLS.
 * The contract is the same: kick provisioning for a hostname, return the
 * resulting status. Cert storage + renewal live behind this seam too.
 */
export interface TlsService {
  /** Begin (or re-check) certificate provisioning for a verified hostname. */
  provision(domain: string): Promise<TlsProvisionResult>;
}

export const TLS_SERVICE = Symbol("TLS_SERVICE");

/**
 * Local/dev mock: pretends issuance succeeds instantly. No cert is created.
 * Logs a loud note so it is obvious this is not real TLS.
 */
@Injectable()
export class MockTlsService implements TlsService {
  private readonly logger = new Logger("MockTlsService");

  provision(domain: string): Promise<TlsProvisionResult> {
    this.logger.warn(
      `MOCK TLS: marking ${domain} as issued WITHOUT a real certificate. ` +
        `Wire ACM / Let's Encrypt (ACME) in production — see TlsService.`,
    );
    return Promise.resolve({ status: "issued", detail: "mock certificate issued (dev)" });
  }
}

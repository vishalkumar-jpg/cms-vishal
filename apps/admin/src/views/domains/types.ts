/**
 * Domain shapes — mirror the API `site_domains` table + domains DTOs.
 * Site-scoped via the X-Site-Id header (Axios mutator), so paths are relative.
 */
export type DomainStatus = "pending" | "verifying" | "verified" | "active" | "failed";
export type TlsStatus = "none" | "pending" | "issued" | "failed";
/** SITE-HEALTH computed cert status (from tlsExpiresAt). */
export type CertStatus = "unknown" | "ok" | "expiring-soon" | "expired" | "error";

export interface Domain {
  id: string;
  siteId: string;
  domain: string;
  isPrimary: boolean;
  verified: boolean;
  status: DomainStatus;
  tlsStatus: TlsStatus;
  verificationToken: string;
  verificationMethod: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // SITE-HEALTH — SSL/cert-expiry monitoring.
  tlsExpiresAt: string | null;
  tlsCheckedAt: string | null;
  tlsCheckError: string | null;
  certStatus: CertStatus;
  daysToExpiry: number | null;
}

/** POST /domains/:id/ssl-check response */
export interface SslCheckResult {
  enqueued: boolean;
  jobId: string | null;
  domain: Domain;
}

/** DNS records the tenant must publish (returned on add). */
export interface DnsInstructions {
  txtRecord: { name: string; type: "TXT"; value: string };
  routing: { type: "CNAME" | "A"; name: string; value: string };
}

/** POST /domains response */
export interface CreateDomainResult {
  domain: Domain;
  instructions: DnsInstructions;
}

/** POST /domains/:id/verify response */
export interface VerifyResult {
  domain: Domain;
  verified: boolean;
  reason?: string;
}

export interface CreateDomainPayload {
  domain: string;
}
